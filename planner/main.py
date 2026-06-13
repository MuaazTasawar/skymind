"""
main.py
Entry point for the SkyMind Python Planner service.

Reads PLANNER_GRPC_PORT from environment (default: 50051)
and starts the gRPC server.
"""

import os
import sys
import logging

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    port_str = os.getenv("PLANNER_GRPC_PORT", "50051")
    try:
        port = int(port_str)
    except ValueError:
        logger.error(f"Invalid PLANNER_GRPC_PORT: {port_str!r} — using 50051")
        port = 50051

    logger.info(f"[main] SkyMind Planner starting on port {port}")

    # Import here so startup logging appears before model loading
    from server import serve
    serve(port=port)


if __name__ == "__main__":
    main()