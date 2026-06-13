"""
fault_injector.py
Simulates drone faults mid-mission for testing fault tolerance.

Can be run standalone to inject faults into a live simulation,
or imported and used programmatically in tests.

Fault types:
  - battery_drain:  Rapidly reduces simulated battery to trigger failsafe
  - heartbeat_kill: Cuts the MAVLink connection to simulate total failure
  - forced_land:    Commands LAND mode immediately
"""

import time
import logging
import threading
import argparse

logger = logging.getLogger(__name__)

# DroneKit Python 3.10+ patch
import collections
import collections.abc
collections.MutableMapping = collections.abc.MutableMapping

from dronekit import connect
from pymavlink import mavutil


class FaultInjector:
    """
    Connects to a running SITL instance and injects a fault.
    """

    def __init__(self, sitl_port: int, drone_name: str = ""):
        self.sitl_port = sitl_port
        self.drone_name = drone_name or f"port:{sitl_port}"
        self.vehicle = None

    def connect(self, timeout: int = 30) -> bool:
        addr = f"tcp:127.0.0.1:{self.sitl_port}"
        try:
            self.vehicle = connect(addr, wait_ready=False, timeout=timeout)
            logger.info(f"[fault] connected to {self.drone_name}")
            return True
        except Exception as e:
            logger.error(f"[fault] connect failed: {e}")
            return False

    def disconnect(self):
        if self.vehicle:
            self.vehicle.close()

    def inject_battery_drain(self, target_pct: int = 10, delay_s: float = 0):
        """
        Simulate a battery drain by overriding the battery parameter.
        ArduPilot will trigger RTL at the failsafe threshold (~20%).
        """
        if delay_s > 0:
            logger.info(
                f"[fault] {self.drone_name} — battery drain in {delay_s}s"
            )
            time.sleep(delay_s)

        logger.warning(
            f"[fault] INJECTING battery drain on {self.drone_name} "
            f"→ {target_pct}%"
        )
        try:
            # Override battery failsafe voltage threshold
            self.vehicle.parameters["BATT_LOW_VOLT"] = 99.0  # always trigger
            self.vehicle.parameters["BATT_FS_LOW_ACT"] = 1   # RTL on low battery
            logger.info(f"[fault] {self.drone_name} battery fault injected")
        except Exception as e:
            logger.error(f"[fault] battery inject error: {e}")

    def inject_forced_land(self, delay_s: float = 0):
        """Force the drone to land immediately."""
        if delay_s > 0:
            logger.info(
                f"[fault] {self.drone_name} — forced land in {delay_s}s"
            )
            time.sleep(delay_s)

        logger.warning(f"[fault] INJECTING forced land on {self.drone_name}")
        try:
            self.vehicle._master.mav.set_mode_send(
                self.vehicle._master.target_system,
                mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
                9,  # LAND mode
            )
            logger.info(f"[fault] {self.drone_name} forced to LAND")
        except Exception as e:
            logger.error(f"[fault] land inject error: {e}")

    def inject_after_delay(self, fault_type: str, delay_s: float = 10.0):
        """
        Inject a fault after a delay in a background thread.
        Non-blocking — returns immediately.
        """
        def _inject():
            if not self.connect():
                return
            if fault_type == "battery_drain":
                self.inject_battery_drain(delay_s=delay_s)
            elif fault_type == "forced_land":
                self.inject_forced_land(delay_s=delay_s)
            else:
                logger.error(f"[fault] unknown fault type: {fault_type}")
            self.disconnect()

        t = threading.Thread(target=_inject, daemon=True)
        t.start()
        return t


def inject_swarm_faults(
    ports: list,
    fault_type: str = "battery_drain",
    delay_s: float = 15.0,
    target_drone_index: int = 1,
):
    """
    Inject a fault on one specific drone in the swarm after a delay.
    Used to demonstrate fault tolerance and zone reassignment.

    Args:
        ports:               List of SITL TCP ports.
        fault_type:          "battery_drain" | "forced_land"
        delay_s:             Seconds after call to inject fault.
        target_drone_index:  Which drone to fault (0-indexed).
    """
    if target_drone_index >= len(ports):
        logger.error("[fault] target_drone_index out of range")
        return

    port = ports[target_drone_index]
    injector = FaultInjector(sitl_port=port, drone_name=f"Drone-{target_drone_index}")
    return injector.inject_after_delay(fault_type, delay_s=delay_s)


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    parser = argparse.ArgumentParser(description="SkyMind Fault Injector")
    parser.add_argument("--port",  type=int, default=5770,
                        help="SITL TCP port to inject fault on (default: 5770 = Bravo)")
    parser.add_argument("--fault", type=str, default="battery_drain",
                        choices=["battery_drain", "forced_land"],
                        help="Fault type to inject")
    parser.add_argument("--delay", type=float, default=0.0,
                        help="Seconds to wait before injecting (default: 0)")
    args = parser.parse_args()

    injector = FaultInjector(sitl_port=args.port)
    if not injector.connect():
        return

    if args.fault == "battery_drain":
        injector.inject_battery_drain(delay_s=args.delay)
    elif args.fault == "forced_land":
        injector.inject_forced_land(delay_s=args.delay)

    injector.disconnect()
    logger.info("[fault] done")


if __name__ == "__main__":
    main()