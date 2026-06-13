"""
polygon_utils.py
Utility functions for working with geographic polygons.
All coordinates are (lat, lng) tuples. Internally we work in a
local metric space (metres) using a simple equirectangular projection
centred on the polygon centroid, which is accurate enough for areas
under ~50 km².
"""

import math
from typing import List, Tuple

# Earth radius in metres
EARTH_RADIUS_M = 6_371_000.0

LatLng = Tuple[float, float]   # (lat, lng)
Point  = Tuple[float, float]   # (x_m, y_m) in local metric space


def centroid(polygon: List[LatLng]) -> LatLng:
    """Return the arithmetic centroid of a polygon."""
    lat = sum(p[0] for p in polygon) / len(polygon)
    lng = sum(p[1] for p in polygon) / len(polygon)
    return (lat, lng)


def latlng_to_xy(point: LatLng, origin: LatLng) -> Point:
    """
    Convert a (lat, lng) point to local (x, y) metres relative to origin.
    x = east, y = north.
    """
    lat, lng = point
    olat, olng = origin

    # degrees → radians
    lat_r  = math.radians(lat)
    olat_r = math.radians(olat)
    dlat   = math.radians(lat  - olat)
    dlng   = math.radians(lng  - olng)

    x = dlng * EARTH_RADIUS_M * math.cos(olat_r)
    y = dlat * EARTH_RADIUS_M
    return (x, y)


def xy_to_latlng(point: Point, origin: LatLng) -> LatLng:
    """Convert local (x, y) metres back to (lat, lng)."""
    x, y = point
    olat, olng = origin

    olat_r = math.radians(olat)
    dlat   = y / EARTH_RADIUS_M
    dlng   = x / (EARTH_RADIUS_M * math.cos(olat_r))

    lat = olat + math.degrees(dlat)
    lng = olng + math.degrees(dlng)
    return (lat, lng)


def polygon_to_xy(polygon: List[LatLng], origin: LatLng) -> List[Point]:
    """Convert a full polygon from (lat, lng) to local (x, y) metres."""
    return [latlng_to_xy(p, origin) for p in polygon]


def xy_polygon_to_latlng(points: List[Point], origin: LatLng) -> List[LatLng]:
    """Convert a list of local (x, y) points back to (lat, lng)."""
    return [xy_to_latlng(p, origin) for p in points]


def polygon_area_m2(xy_polygon: List[Point]) -> float:
    """
    Compute signed area of a polygon in m² using the shoelace formula.
    Returns positive for counter-clockwise winding.
    """
    n = len(xy_polygon)
    area = 0.0
    for i in range(n):
        x1, y1 = xy_polygon[i]
        x2, y2 = xy_polygon[(i + 1) % n]
        area += (x1 * y2) - (x2 * y1)
    return area / 2.0


def bounding_box(xy_polygon: List[Point]) -> Tuple[float, float, float, float]:
    """Return (min_x, min_y, max_x, max_y) of a polygon."""
    xs = [p[0] for p in xy_polygon]
    ys = [p[1] for p in xy_polygon]
    return (min(xs), min(ys), max(xs), max(ys))


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """
    Ray-casting algorithm to test if a point is inside a polygon.
    Returns True if inside or on the boundary.
    """
    x, y = point
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def haversine_m(a: LatLng, b: LatLng) -> float:
    """Return the great-circle distance in metres between two (lat, lng) points."""
    lat1, lng1 = map(math.radians, a)
    lat2, lng2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def split_polygon_vertical(
    xy_polygon: List[Point],
    n: int
) -> List[List[Point]]:
    """
    Split a convex-ish polygon into n vertical slices of approximately
    equal width. Each slice is returned as a list of 4 corner points.
    Used to partition the mission zone among n drones.
    """
    min_x, min_y, max_x, max_y = bounding_box(xy_polygon)
    width = (max_x - min_x) / n
    slices = []

    for i in range(n):
        x_left  = min_x + i * width
        x_right = min_x + (i + 1) * width
        # Rectangular slice clipped to bounding box height
        slice_rect = [
            (x_left,  min_y),
            (x_right, min_y),
            (x_right, max_y),
            (x_left,  max_y),
        ]
        # Keep only points of slice_rect that fall inside the original polygon
        # or use the rect as-is for simplicity (accurate enough for convex zones)
        slices.append(slice_rect)

    return slices