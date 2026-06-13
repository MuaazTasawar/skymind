"""
launcher.py
Launches multiple ArduPilot SITL instances and runs drone agents
through a complete swarm mission.

Usage:
  python launcher.py                  # 5-drone default mission
  python launcher.py --drones 3       # 3-drone mission
  python launcher.py --demo           # formation demo only (no waypoints)

Each SITL instance is allocated a separate TCP port starting at 5760,
incrementing by 10 per drone (5760, 5770, 5780, ...).
"""

import sys
import time
import queue
import logging
import argparse
import threading

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# DroneKit Python 3.10+ patch
import collections
import collections.abc
collections.MutableMapping = collections.abc.MutableMapping

import dronekit_sitl
from drone_agent import DroneAgent


# ── Default test mission — small square near Islamabad ────────────────────────
DEFAULT_WAYPOINTS_PER_DRONE = [
    [
        {"lat": 33.7295, "lng": 73.0931, "alt": 10.0},
        {"lat": 33.7300, "lng": 73.0931, "alt": 10.0},
        {"lat": 33.7300, "lng": 73.0940, "alt": 10.0},
        {"lat": 33.7295, "lng": 73.0940, "alt": 10.0},
    ],
    [
        {"lat": 33.7295, "lng": 73.0941, "alt": 10.0},
        {"lat": 33.7300, "lng": 73.0941, "alt": 10.0},
        {"lat": 33.7300, "lng": 73.0950, "alt": 10.0},
        {"lat": 33.7295, "lng": 73.0950, "alt": 10.0},
    ],
    [
        {"lat": 33.7295, "lng": 73.0951, "alt": 10.0},
        {"lat": 33.7300, "lng": 73.0951, "alt": 10.0},
        {"lat": 33.7300, "lng": 73.0960, "alt": 10.0},
        {"lat": 33.7295, "lng": 73.0960, "alt": 10.0},
    ],
    [
        {"lat": 33.7285, "lng": 73.0931, "alt": 12.0},
        {"lat": 33.7290, "lng": 73.0931, "alt": 12.0},
        {"lat": 33.7290, "lng": 73.0945, "alt": 12.0},
        {"lat": 33.7285, "lng": 73.0945, "alt": 12.0},
    ],
    [
        {"lat": 33.7285, "lng": 73.0946, "alt": 12.0},
        {"lat": 33.7290, "lng": 73.0946, "alt": 12.0},
        {"lat": 33.7290, "lng": 73.0960, "alt": 12.0},
        {"lat": 33.7285, "lng": 73.0960, "alt": 12.0},
    ],
]

DRONE_CONFIGS = [
    {"id": "drone-1", "name": "Alpha"},
    {"id": "drone-2", "name": "Bravo"},
    {"id": "drone-3", "name": "Charlie"},
    {"id": "drone-4", "name": "Delta"},
    {"id": "drone-5", "name": "Echo"},
]

BASE_PORT = 5760
PORT_STEP = 10


def launch_sitl_instances(n: int) -> list:
    """Launch n SITL instances and return them."""
    sitl_list = []
    for i in range(n):
        port = BASE_PORT + i * PORT_STEP
        logger.info(f"[launcher] starting SITL instance {i+1}/{n} on port {port}")
        sitl = dronekit_sitl.SITL(instance=i)
        sitl.download("copter", "3.3", verbose=False)
        sitl.launch(
            [],
            await_ready=True,
            restart=True,
            wd="/tmp",
        )
        sitl_list.append(sitl)
        time.sleep(1)  # stagger launches
    logger.info(f"[launcher] {n} SITL instances running")
    return sitl_list


def run_swarm_mission(n_drones: int):
    """Launch SITL, connect agents, run missions in parallel."""
    sitl_list = launch_sitl_instances(n_drones)
    status_queue = queue.Queue()
    threads = []
    agents = []

    for i in range(n_drones):
        cfg = DRONE_CONFIGS[i]
        port = BASE_PORT + i * PORT_STEP
        waypoints = DEFAULT_WAYPOINTS_PER_DRONE[i % len(DEFAULT_WAYPOINTS_PER_DRONE)]

        agent = DroneAgent(
            drone_id=cfg["id"],
            name=cfg["name"],
            sitl_port=port,
            status_queue=status_queue,
        )
        agents.append(agent)

        t = threading.Thread(
            target=agent.run_mission,
            args=(waypoints,),
            daemon=True,
        )
        threads.append(t)

    logger.info(f"[launcher] starting {n_drones} drone missions in parallel")

    # Stagger takeoffs slightly to avoid MAVLink collisions
    for i, t in enumerate(threads):
        t.start()
        time.sleep(2)

    # Status monitor
    completed = set()
    while len(completed) < n_drones:
        try:
            update = status_queue.get(timeout=120)
            drone_id = update["drone_id"]
            status   = update["status"]
            logger.info(f"  [{update['name']}] {status}")

            if status in ("mission_complete", "connection_failed") or \
               status.startswith("error"):
                completed.add(drone_id)
        except queue.Empty:
            logger.warning("[launcher] status timeout — some drones may be stuck")
            break

    logger.info("[launcher] all missions finished — stopping SITL")
    for sitl in sitl_list:
        sitl.stop()

    logger.info("[launcher] done")


def main():
    parser = argparse.ArgumentParser(description="SkyMind SITL Swarm Launcher")
    parser.add_argument(
        "--drones", type=int, default=5,
        help="Number of drones to launch (default: 5)"
    )
    args = parser.parse_args()

    n = min(args.drones, len(DRONE_CONFIGS))
    logger.info(f"[launcher] SkyMind SITL — launching {n} drone swarm")
    run_swarm_mission(n)


if __name__ == "__main__":
    main()