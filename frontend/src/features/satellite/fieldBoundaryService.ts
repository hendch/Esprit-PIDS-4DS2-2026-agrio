import { httpClient } from "../../core/api/httpClient";

export type BoundaryPoint = {
  latitude: number;
  longitude: number;
};

export type FieldBoundaryPayload = {
  name: string;
  cropType?: string;
  areaHa?: number;
  points: BoundaryPoint[];

  // Enriched field profile
  governorate?: string;
  plantingDate?: string;
  irrigated?: boolean;
  irrigationMethod?: string;
  fieldNotes?: string;
};

export type FieldBoundaryRecord = {
  id: string;
  name: string;
  cropType?: string;
  areaHa?: number;
  createdAt: string;
  points: BoundaryPoint[];

  // Enriched field profile
  governorate?: string;
  plantingDate?: string;
  irrigated: boolean;
  irrigationMethod?: string;
  fieldNotes?: string;

  // Derived context
  centroidLat?: number;
  centroidLon?: number;
};

type FieldApiResponse = {
  id: string;
  farm_id: string;
  name: string;
  crop_type: string | null;
  area_ha: number | null;
  created_at: string;
  boundary: {
    type: "Polygon";
    coordinates: number[][][];
  };

  // Enriched field profile from backend
  centroid_lat?: number | null;
  centroid_lon?: number | null;
  governorate?: string | null;
  planting_date?: string | null;
  irrigated?: boolean;
  irrigation_method?: string | null;
  field_notes?: string | null;
};

export type FieldStatus = "Good" | "Warning" | "Poor";

export type FieldDisplayItem = {
  id: string;
  name: string;
  crop: string;
  status: FieldStatus;
  ndvi: number;
  soilFertility: "High" | "Medium" | "Low";
  areaHa: number;
  healthScore: number;
  planted: string;
  estHarvest: string;
  imageTint: string;
  points: BoundaryPoint[];

  // Enriched field profile
  governorate?: string;
  irrigated: boolean;
  irrigationMethod?: string;
  fieldNotes?: string;
  plantingDate?: string;

  // Derived context
  centroidLat?: number;
  centroidLon?: number;
};

function toGeoJsonPolygon(points: BoundaryPoint[]) {
  const ring = points.map((point) => [point.longitude, point.latitude]);
  const first = ring[0];
  const last = ring[ring.length - 1];

  const closedRing =
    first && last && (first[0] !== last[0] || first[1] !== last[1])
      ? [...ring, first]
      : ring;

  return {
    type: "Polygon" as const,
    coordinates: [closedRing],
  };
}

function fromGeoJsonPolygon(boundary: FieldApiResponse["boundary"]): BoundaryPoint[] {
  const ring = boundary.coordinates[0] ?? [];
  if (ring.length === 0) {
    return [];
  }

  const withoutClosingPoint =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;

  return withoutClosingPoint.map(([longitude, latitude]) => ({
    latitude,
    longitude,
  }));
}

function toFieldBoundaryRecord(data: FieldApiResponse): FieldBoundaryRecord {
  return {
    id: data.id,
    name: data.name,
    cropType: data.crop_type ?? undefined,
    areaHa: data.area_ha ?? undefined,
    createdAt: data.created_at,
    points: fromGeoJsonPolygon(data.boundary),

    governorate: data.governorate ?? undefined,
    plantingDate: data.planting_date ?? undefined,
    irrigated: Boolean(data.irrigated),
    irrigationMethod: data.irrigation_method ?? undefined,
    fieldNotes: data.field_notes ?? undefined,

    centroidLat: data.centroid_lat ?? undefined,
    centroidLon: data.centroid_lon ?? undefined,
  };
}

function formatDate(value?: string): string {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function estimateHarvestDate(value?: string): string {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  date.setMonth(date.getMonth() + 5);
  return formatDate(date.toISOString());
}

function colorForIndex(index: number): string {
  const colors = ["#81C784", "#DCE775", "#A5D6A7", "#9CCC65", "#AED581"];
  return colors[index % colors.length];
}

export function toFieldDisplayItem(record: FieldBoundaryRecord, index = 0): FieldDisplayItem {
  const crop = record.cropType || "Unassigned crop";

  return {
    id: record.id,
    name: record.name,
    crop,

    // NOTE: these are still placeholder display values for now.
    // We can remove/replace them later in LandScreen and FieldDetailScreen.
    status: "Good",
    ndvi: 0.72,
    soilFertility: "Medium",
    healthScore: 86,

    areaHa: Number((record.areaHa ?? 0).toFixed(2)),
    planted: formatDate(record.plantingDate || record.createdAt),
    estHarvest: estimateHarvestDate(record.plantingDate || record.createdAt),
    imageTint: colorForIndex(index),
    points: record.points,

    governorate: record.governorate,
    irrigated: record.irrigated,
    irrigationMethod: record.irrigationMethod,
    fieldNotes: record.fieldNotes,
    plantingDate: record.plantingDate,
    centroidLat: record.centroidLat,
    centroidLon: record.centroidLon,
  };
}

export async function listFieldBoundaries(): Promise<FieldBoundaryRecord[]> {
  const { data } = await httpClient.get<FieldApiResponse[]>("/api/v1/fields/");
  return data.map(toFieldBoundaryRecord);
}

export async function getFieldBoundary(fieldId: string): Promise<FieldBoundaryRecord> {
  const { data } = await httpClient.get<FieldApiResponse>(`/api/v1/fields/${fieldId}`);
  return toFieldBoundaryRecord(data);
}

export async function saveFieldBoundary(
  payload: FieldBoundaryPayload,
): Promise<FieldBoundaryRecord> {
  const { data } = await httpClient.post<FieldApiResponse>("/api/v1/fields/", {
    name: payload.name,
    crop_type: payload.cropType ?? null,
    area_ha: payload.areaHa ?? null,
    boundary: toGeoJsonPolygon(payload.points),

    governorate: payload.governorate ?? null,
    planting_date: payload.plantingDate ?? null,
    irrigated: payload.irrigated ?? false,
    irrigation_method: payload.irrigationMethod ?? null,
    field_notes: payload.fieldNotes ?? null,
  });

  return toFieldBoundaryRecord(data);
}

export async function updateFieldBoundary(
  fieldId: string,
  payload: FieldBoundaryPayload,
): Promise<FieldBoundaryRecord> {
  const { data } = await httpClient.patch<FieldApiResponse>(`/api/v1/fields/${fieldId}`, {
    name: payload.name,
    crop_type: payload.cropType ?? null,
    area_ha: payload.areaHa ?? null,
    boundary: toGeoJsonPolygon(payload.points),

    governorate: payload.governorate ?? null,
    planting_date: payload.plantingDate ?? null,
    irrigated: payload.irrigated ?? false,
    irrigation_method: payload.irrigationMethod ?? null,
    field_notes: payload.fieldNotes ?? null,
  });

  return toFieldBoundaryRecord(data);
}

export async function deleteFieldBoundary(fieldId: string): Promise<void> {
  await httpClient.delete(`/api/v1/fields/${fieldId}`);
}
``
