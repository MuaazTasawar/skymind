"""
drone_agent.py
Controls a single SITL drone via DroneKit.

Each DroneAgent runs in its own thread and handles:
  - Arming and takeoff
  - Flying a list of GPS waypoints in GUIDED mode
  - Returning to launch (RTL)
  - Reporting status back via a shared queue
"""

import time
import threading
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Apply DroneKit Python 3.10+ compatibility patch
import collections
import collections.abc
collections.MutableMapping = collections.abc.MutableMapping

from dronekit import connect, VehicleMode, LocationGlobalRelative
from pymavlink import mavutil


class DroneAgent:
    """
    Controls one SITL drone instance.
    """

    def __init__(
        self,
        drone_id: str,
        name: str,
        sitl_port: int,
        status_queue=None,
    ):
        self.drone_id = drone_id
        self.name = name
        self.sitl_port = sitl_port
        self.status_queue = status_queue
        self.vehicle = None
        self._stop_event = threading.Event()

    # ── Connection ────────────────────────────────────────────────────────

    def connect(self, timeout: int = 60) -> bool:
        """Connect to the SITL instance on the given TCP port."""
        addr = f"tcp:127.0.0.1:{self.sitl_port}"
        logger.info(f"[{self.name}] connecting to {addr}")
        try:
            self.vehicle = connect(addr, wait_ready=True, timeout=timeout)
            logger.info(f"[{self.name}] connected")
            self._report("connected")
            return True
        except Exception as e:
            logger.error(f"[{self.name}] connection failed: {e}")
            self._report("connection_failed")
            return False

    def disconnect(self):
        if self.vehicle:
            self.vehicle.close()
            logger.info(f"[{self.name}] disconnected")

    # ── Pre-flight ────────────────────────────────────────────────────────

    def _set_mode(self, mode_name: str, timeout: int = 30):
        """Set flight mode using direct MAVLink to avoid DroneKit TCP issues."""
        mode_map = {
            "GUIDED": 4,
            "AUTO":   3,
            "RTL":    6,
            "LAND":   9,
        }
        mode_id = mode_map.get(mode_name)
        if mode_id is None:
            raise ValueError(f"Unknown mode: {mode_name}")

        self.vehicle._master.mav.set_mode_send(
            self.vehicle._master.target_system,
            mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
            mode_id,
        )

        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.vehicle.mode.name == mode_name:
                return True
            time.sleep(0.5)

        logger.warning(f"[{self.name}] mode {mode_name} not confirmed in {timeout}s")
        return False

    def _disable_prearm_checks(self):
        """Disable ArduPilot pre-arm checks for SITL."""
        self.vehicle.parameters["ARMING_CHECK"] = 0
        time.sleep(0.5)

    def arm(self, timeout: int = 30) -> bool:
        """Arm the drone."""
        self._disable_prearm_checks()
        self._set_mode("GUIDED")

        # Wait for GPS fix
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.vehicle.gps_0.fix_type >= 2:
                break
            logger.debug(f"[{self.name}] waiting for GPS fix...")
            time.sleep(1)

        self.vehicle.armed = True

        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.vehicle.armed:
                logger.info(f"[{self.name}] armed")
                self._report("armed")
                return True
            time.sleep(0.5)

        logger.error(f"[{self.name}] arm timeout")
        return False

    # ── Flight ────────────────────────────────────────────────────────────

    def takeoff(self, altitude_m: float = 10.0, timeout: int = 60) -> bool:
        """Take off to the specified altitude."""
        logger.info(f"[{self.name}] taking off to {altitude_m}m")
        self.vehicle.simple_takeoff(altitude_m)

        deadline = time.time() + timeout
        while time.time() < deadline:
            alt = self.vehicle.location.global_relative_frame.alt or 0
            logger.debug(f"[{self.name}] alt={alt:.1f}m / {altitude_m}m")
            if alt >= altitude_m * 0.92:
                logger.info(f"[{self.name}] reached {altitude_m}m")
                self._report("airborne")
                return True
            if self._stop_event.is_set():
                return False
            time.sleep(1)

        logger.error(f"[{self.name}] takeoff timeout")
        return False

    def fly_waypoints(
        self,
        waypoints: List[Dict[str, float]],
        acceptance_radius_m: float = 2.0,
        timeout_per_wp: int = 60,
    ) -> bool:
        """
        Fly through a list of waypoints in GUIDED mode.
        Each waypoint is a dict: {"lat": ..., "lng": ..., "alt": ...}
        """
        logger.info(f"[{self.name}] flying {len(waypoints)} waypoints")
        self._set_mode("GUIDED")

        for i, wp in enumerate(waypoints):
            if self._stop_event.is_set():
                logger.info(f"[{self.name}] stop requested at wp {i}")
                return False

            target = LocationGlobalRelative(wp["lat"], wp["lng"], wp["alt"])
            self.vehicle.simple_goto(target)
            self._report(f"waypoint_{i+1}_of_{len(waypoints)}")

            # Wait until within acceptance radius
            deadline = time.time() + timeout_per_wp
            while time.time() < deadline:
                if self._stop_event.is_set():
                    return False

                current = self.vehicle.location.global_relative_frame
                if current is None:
                    time.sleep(0.5)
                    continue

                dist = self._distance_m(
                    current.lat, current.lon,
                    wp["lat"], wp["lng"],
                )

                if dist <= acceptance_radius_m:
                    logger.info(f"[{self.name}] wp {i+1}/{len(waypoints)} reached")
                    break
                time.sleep(0.5)
            else:
                logger.warning(f"[{self.name}] wp {i+1} timeout — continuing")

        self._report("waypoints_complete")
        return True

    def rtl(self):
        """Return to launch."""
        logger.info(f"[{self.name}] RTL")
        self._set_mode("RTL")
        self._report("rtl")

    def land(self):
        """Land in place."""
        logger.info(f"[{self.name}] LAND")
        self._set_mode("LAND")
        self._report("landing")

    def stop(self):
        """Signal the agent to stop mid-mission."""
        self._stop_event.set()

    # ── Mission runner ────────────────────────────────────────────────────

    def run_mission(
        self,
        waypoints: List[Dict[str, float]],
        altitude_m: float = 10.0,
    ):
        """
        Full mission sequence: arm → takeoff → waypoints → RTL.
        Designed to run in a thread.
        """
        try:
            if not self.connect():
                return
            if not self.arm():
                return
            if not self.takeoff(altitude_m):
                return
            self.fly_waypoints(waypoints)
            self.rtl()

            # Wait for landing
            while self.vehicle.armed:
                if self._stop_event.is_set():
                    break
                time.sleep(2)

            self._report("mission_complete")
            logger.info(f"[{self.name}] mission complete")

        except Exception as e:
            logger.exception(f"[{self.name}] mission error: {e}")
            self._report(f"error: {e}")
        finally:
            self.disconnect()

    # ── Helpers ───────────────────────────────────────────────────────────

    def _report(self, status: str):
        if self.status_queue is not None:
            self.status_queue.put({
                "drone_id": self.drone_id,
                "name":     self.name,
                "status":   status,
            })

    @staticmethod
    def _distance_m(lat1, lon1, lat2, lon2) -> float:
        """Approximate distance in metres using equirectangular projection."""
        import math
        R = 6_371_000.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        mlat = math.radians((lat1 + lat2) / 2)
        x = dlon * math.cos(mlat)
        return R * math.sqrt(dlat**2 + x**2)