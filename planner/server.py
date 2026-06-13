"""
server.py
gRPC server implementing PlannerService.

Handles three RPCs:
  1. PlanMission    — decomposes zone polygon, generates coverage paths,
                      allocates drones via Hungarian algorithm.
  2. ReassignZone   — reassigns a faulted drone's zone to the nearest
                      available drone (fault tolerance).
  3. DetectObjects  — runs YOLOv8 inference on a JPEG frame.
"""

import os
import sys
import time
import logging
import concurrent.futures
from typing import List

import grpc

# Add project root to path so proto imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from proto import planner_pb2, planner_pb2_grpc
from coverage.polygon_utils import (
    centroid,
    split_polygon_vertical,
    polygon_to_xy,
    xy_polygon_to_latlng,
)
from coverage.boustrophedon import generate_coverage_path
from allocation.hungarian import allocate, reallocate_faulted_zone
from vision.detector import ObjectDetector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Singleton detector — loaded lazily on first DetectObjects call
_detector = ObjectDetector(model_name="yolov8n.pt", confidence=0.35)


def _proto_latlng_list(latlngs) -> List[tuple]:
    """Convert repeated LatLng proto messages to (lat, lng) tuples."""
    return [(ll.lat, ll.lng) for ll in latlngs]


def _proto_drone_list(drones) -> List[dict]:
    """Convert repeated DroneInfo proto messages to dicts."""
    return [
        {
            "drone_id": d.drone_id,
            "name":     d.name,
            "lat":      d.lat,
            "lng":      d.lng,
            "battery":  d.battery,
        }
        for d in drones
    ]


class PlannerServicer(planner_pb2_grpc.PlannerServiceServicer):
    """Implements all three PlannerService RPCs."""

    # ── PlanMission ──────────────────────────────────────────────────────
    def PlanMission(self, request, context):
        logger.info(
            f"[PlanMission] mission={request.mission_id} "
            f"drones={len(request.drones)} "
            f"polygon_pts={len(request.zone_polygon)}"
        )

        try:
            zone_polygon = _proto_latlng_list(request.zone_polygon)
            drones       = _proto_drone_list(request.drones)
            altitude_m   = request.altitude_m   or 10.0
            airspeed_ms  = request.airspeed_ms  or 5.0
            strip_width  = request.strip_width_m or 10.0

            if len(zone_polygon) < 3:
                return planner_pb2.PlanMissionResponse(
                    mission_id=request.mission_id,
                    status="error",
                    error="zone_polygon must have at least 3 points",
                )

            n_drones = max(len(drones), 1)

            # 1. Split the polygon into n_drones vertical sub-zones
            origin   = centroid(zone_polygon)
            xy_poly  = polygon_to_xy(zone_polygon, origin)
            xy_slices = split_polygon_vertical(xy_poly, n_drones)
            sub_zones = [
                xy_polygon_to_latlng(sl, origin) for sl in xy_slices
            ]

            # 2. Generate boustrophedon path for each sub-zone
            zone_paths = [
                generate_coverage_path(zone, altitude_m, strip_width)
                for zone in sub_zones
            ]

            # 3. Allocate drones to zones via Hungarian algorithm
            assignments = allocate(drones, zone_paths)

            # 4. Build proto response
            zone_protos = []
            for i, asn in enumerate(assignments):
                wp_protos = [
                    planner_pb2.Waypoint(
                        lat=wp["lat"],
                        lng=wp["lng"],
                        alt_m=wp["alt"],
                    )
                    for wp in asn["waypoints"]
                ]
                sub_poly_protos = [
                    planner_pb2.LatLng(lat=ll[0], lng=ll[1])
                    for ll in sub_zones[i % len(sub_zones)]
                ]
                zone_protos.append(
                    planner_pb2.ZoneAssignment(
                        zone_id=asn["zone_id"],
                        drone_id=asn["drone_id"],
                        waypoints=wp_protos,
                        sub_polygon=sub_poly_protos,
                    )
                )

            logger.info(
                f"[PlanMission] mission={request.mission_id} "
                f"generated {len(zone_protos)} zone assignments"
            )

            return planner_pb2.PlanMissionResponse(
                mission_id=request.mission_id,
                zones=zone_protos,
                status="ok",
            )

        except Exception as e:
            logger.exception(f"[PlanMission] error: {e}")
            return planner_pb2.PlanMissionResponse(
                mission_id=request.mission_id,
                status="error",
                error=str(e),
            )

    # ── ReassignZone ─────────────────────────────────────────────────────
    def ReassignZone(self, request, context):
        logger.info(
            f"[ReassignZone] mission={request.mission_id} "
            f"faulted_drone={request.faulted_drone_id} "
            f"faulted_zone={request.faulted_zone_id}"
        )

        try:
            available_drones = _proto_drone_list(request.available_drones)
            altitude_m  = request.altitude_m  or 10.0
            strip_width = request.strip_width_m or 10.0

            if not available_drones:
                return planner_pb2.ReassignZoneResponse(
                    status="error",
                    error="no available drones for reassignment",
                )

            # For reassignment we don't have the original sub-zone polygon,
            # so we generate a simple single-strip path as placeholder.
            # In production this would use the stored zone geometry from DB.
            placeholder_path = [
                {"lat": d["lat"], "lng": d["lng"], "alt": altitude_m}
                for d in available_drones[:2]
            ]

            result = reallocate_faulted_zone(
                faulted_zone_path=placeholder_path,
                faulted_zone_id=request.faulted_zone_id,
                available_drones=available_drones,
            )

            if not result:
                return planner_pb2.ReassignZoneResponse(
                    status="error",
                    error="allocation failed",
                )

            wp_protos = [
                planner_pb2.Waypoint(
                    lat=wp["lat"],
                    lng=wp["lng"],
                    alt_m=wp["alt"],
                )
                for wp in result["waypoints"]
            ]

            new_zone = planner_pb2.ZoneAssignment(
                zone_id=result["zone_id"],
                drone_id=result["drone_id"],
                waypoints=wp_protos,
            )

            logger.info(
                f"[ReassignZone] zone={result['zone_id']} → "
                f"drone={result['drone_id']}"
            )

            return planner_pb2.ReassignZoneResponse(
                replacement_drone_id=result["drone_id"],
                new_zones=[new_zone],
                status="ok",
            )

        except Exception as e:
            logger.exception(f"[ReassignZone] error: {e}")
            return planner_pb2.ReassignZoneResponse(
                status="error",
                error=str(e),
            )

    # ── DetectObjects ─────────────────────────────────────────────────────
    def DetectObjects(self, request, context):
        logger.info(
            f"[DetectObjects] drone={request.drone_id} "
            f"frame_size={len(request.frame_jpeg)}B"
        )

        try:
            detections = _detector.detect(
                frame_jpeg=request.frame_jpeg,
                drone_id=request.drone_id,
                mission_id=request.mission_id,
            )

            det_protos = [
                planner_pb2.Detection(
                    label=d["label"],
                    confidence=d["confidence"],
                    x1=d["x1"],
                    y1=d["y1"],
                    x2=d["x2"],
                    y2=d["y2"],
                )
                for d in detections
            ]

            return planner_pb2.DetectObjectsResponse(
                drone_id=request.drone_id,
                detections=det_protos,
                timestamp_ms=int(time.time() * 1000),
            )

        except Exception as e:
            logger.exception(f"[DetectObjects] error: {e}")
            return planner_pb2.DetectObjectsResponse(
                drone_id=request.drone_id,
                detections=[],
                timestamp_ms=int(time.time() * 1000),
            )


def serve(port: int = 50051):
    """Start the gRPC server and block until interrupted."""
    server = grpc.server(
        concurrent.futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ("grpc.max_receive_message_length", 50 * 1024 * 1024),  # 50MB
            ("grpc.max_send_message_length",    50 * 1024 * 1024),
        ],
    )

    planner_pb2_grpc.add_PlannerServiceServicer_to_server(
        PlannerServicer(), server
    )

    listen_addr = f"[::]:{port}"
    server.add_insecure_port(listen_addr)
    server.start()

    logger.info(f"[planner] gRPC server started on port {port}")
    logger.info("[planner] waiting for requests...")

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("[planner] shutting down...")
        server.stop(grace=5)
        logger.info("[planner] stopped")