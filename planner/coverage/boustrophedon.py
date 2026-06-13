"""
boustrophedon.py
Generates a boustrophedon (lawnmower) coverage path for a polygon zone.

Algorithm:
  1. Project the polygon into local metric space (metres).
  2. Compute the bounding box.
  3. Sweep horizontal scan lines spaced strip_width_m apart.
  4. For each scan line, find intersection segments with the polygon.
  5. Alternate direction (left→right, right→left) for each row.
  6. Add a start descent and end ascent waypoint at the mission altitude.
  7. Project waypoints back to (lat, lng).

The result is a list of Waypoint dicts: {"lat": ..., "lng": ..., "alt": ...}
"""

from typing import List, Dict, Any, Tuple
import math

from .polygon_utils import (
    LatLng,
    Point,
    centroid,
    latlng_to_xy,
    xy_to_latlng,
    polygon_to_xy,
    bounding_box,
    point_in_polygon,
)

Waypoint = Dict[str, float]  # {"lat": float, "lng": float, "alt": float}


def _segment_intersect_y(
    y: float,
    p1: Point,
    p2: Point
) -> float | None:
    """
    Return the x-coordinate where a horizontal line at height y
    intersects the segment (p1, p2), or None if no intersection.
    """
    x1, y1 = p1
    x2, y2 = p2
    if (y1 <= y < y2) or (y2 <= y < y1):
        t = (y - y1) / (y2 - y1)
        return x1 + t * (x2 - x1)
    return None


def _scanline_intersections(
    y: float,
    polygon: List[Point]
) -> List[float]:
    """
    Return sorted list of x-coordinates where the horizontal line y
    intersects the polygon boundary.
    """
    xs = []
    n = len(polygon)
    for i in range(n):
        p1 = polygon[i]
        p2 = polygon[(i + 1) % n]
        x = _segment_intersect_y(y, p1, p2)
        if x is not None:
            xs.append(x)
    return sorted(xs)


def generate_coverage_path(
    zone_polygon: List[LatLng],
    altitude_m: float = 10.0,
    strip_width_m: float = 10.0,
) -> List[Waypoint]:
    """
    Generate a boustrophedon coverage path for the given zone polygon.

    Args:
        zone_polygon:  List of (lat, lng) tuples defining the zone boundary.
        altitude_m:    Flight altitude in metres AGL.
        strip_width_m: Distance between adjacent scan lines (metres).

    Returns:
        Ordered list of waypoints: [{"lat": ..., "lng": ..., "alt": ...}, ...]
    """
    if len(zone_polygon) < 3:
        return []

    origin = centroid(zone_polygon)
    xy_poly = polygon_to_xy(zone_polygon, origin)

    min_x, min_y, max_x, max_y = bounding_box(xy_poly)

    waypoints: List[Waypoint] = []
    row = 0
    y = min_y + strip_width_m / 2.0

    while y <= max_y:
        xs = _scanline_intersections(y, xy_poly)

        if len(xs) >= 2:
            # Take the outermost pair of intersections
            x_start = xs[0]
            x_end   = xs[-1]

            # Alternate direction each row (boustrophedon)
            if row % 2 == 0:
                pts = [(x_start, y), (x_end, y)]
            else:
                pts = [(x_end, y), (x_start, y)]

            for pt in pts:
                latlng = xy_to_latlng(pt, origin)
                waypoints.append({
                    "lat": round(latlng[0], 7),
                    "lng": round(latlng[1], 7),
                    "alt": altitude_m,
                })

        y   += strip_width_m
        row += 1

    return waypoints


def generate_paths_for_zones(
    zone_polygons: List[List[LatLng]],
    altitude_m: float = 10.0,
    strip_width_m: float = 10.0,
) -> List[List[Waypoint]]:
    """
    Generate coverage paths for multiple sub-zones in parallel.
    Returns a list of waypoint lists, one per zone.
    """
    return [
        generate_coverage_path(zone, altitude_m, strip_width_m)
        for zone in zone_polygons
    ]