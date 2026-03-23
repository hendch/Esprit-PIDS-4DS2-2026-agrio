from __future__ import annotations


def validate_geojson(data: dict) -> bool:
    if not isinstance(data, dict):
        return False
    geojson_type = data.get("type")
    if geojson_type in ("Feature", "FeatureCollection", "Point", "MultiPoint",
                         "LineString", "MultiLineString", "Polygon",
                         "MultiPolygon", "GeometryCollection"):
        if geojson_type == "Feature":
            return "geometry" in data and "properties" in data
        if geojson_type == "FeatureCollection":
            return isinstance(data.get("features"), list)
        return "coordinates" in data or geojson_type == "GeometryCollection"
    return False


def compute_area_m2(polygon: dict) -> float:
    # TODO: implement real geodesic area calculation (e.g. pyproj + shapely)
    return 0.0


def polygon_centroid(polygon: dict) -> tuple[float, float]:
    coords = polygon.get("coordinates", [[]])
    ring = coords[0] if coords else []
    if not ring:
        return (0.0, 0.0)
    n = len(ring)
    avg_lon = sum(p[0] for p in ring) / n
    avg_lat = sum(p[1] for p in ring) / n
    return (avg_lon, avg_lat)
