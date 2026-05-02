import { httpClient } from "../../core/api/httpClient";
import {
  cropCategoryLabel,
  cropLabel,
  fieldTypeLabel,
  growthStageFromPlantingDate,
} from "./cropOptions";

export type BoundaryPoint = {
  latitude: number;
  longitude: number;
};

export type FieldBoundaryPayload = {
  name: string;
  cropType?: string;
  plantingDate?: string;
  fieldType?: string;
  cropCategories?: string[];
  varieties?: string[];
  areaHa?: number;
  points: BoundaryPoint[];
};

export type FieldBoundaryRecord = {
  id: string;
  name: string;
  cropType?: string;
  plantingDate?: string;
  fieldType?: string;
  cropCategories: string[];
  varieties: string[];
  areaHa?: number;
  createdAt: string;
  points: BoundaryPoint[];
};

type FieldApiResponse = {
  id: string;
  farm_id: string;
  name: string;
  crop_type: string | null;
  planting_date: string | null;
  field_type: string | null;
  crop_categories: string[] | null;
  varieties: string[] | null;
  area_ha: number | null;
  created_at: string;
  boundary: {
    type: "Polygon";
    coordinates: number[][][];
    properties?: {
      planting_date?: string | null;
      field_type?: string | null;
      crop_categories?: string[] | null;
      varieties?: string[] | null;
    };
  };
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
  growthStage: string;
  fieldType: string;
  cropCategories: string;
  varieties: string;
  imageTint: string;
  points: BoundaryPoint[];
};

function toGeoJsonPolygon(payload: FieldBoundaryPayload) {
  const { points } = payload;
  const ring = points.map((point) => [point.longitude, point.latitude]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closedRing =
    first && last && (first[0] !== last[0] || first[1] !== last[1]) ? [...ring, first] : ring;

  return {
    type: "Polygon" as const,
    coordinates: [closedRing],
    properties: {
      planting_date: payload.plantingDate ?? null,
      field_type: payload.fieldType ?? null,
      crop_categories: payload.cropCategories ?? [],
      varieties: payload.varieties ?? [],
    },
  };
}

function fromGeoJsonPolygon(boundary: FieldApiResponse["boundary"]): BoundaryPoint[] {
  const ring = boundary.coordinates[0] ?? [];
  if (ring.length === 0) {
    return [];
  }
  const withoutClosingPoint =
    ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;
  return withoutClosingPoint.map(([longitude, latitude]) => ({ latitude, longitude }));
}

function toFieldBoundaryRecord(data: FieldApiResponse): FieldBoundaryRecord {
  const properties = data.boundary.properties ?? {};
  return {
    id: data.id,
    name: data.name,
    cropType: data.crop_type ?? undefined,
    plantingDate: data.planting_date ?? properties.planting_date ?? undefined,
    fieldType: data.field_type ?? properties.field_type ?? undefined,
    cropCategories: data.crop_categories ?? properties.crop_categories ?? [],
    varieties: data.varieties ?? properties.varieties ?? [],
    areaHa: data.area_ha ?? undefined,
    createdAt: data.created_at,
    points: fromGeoJsonPolygon(data.boundary),
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function estimateHarvestDate(value: string): string {
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
  const crop = cropLabel(record.cropType);
  const plantedSource = record.plantingDate ?? record.createdAt;
  const categories = record.cropCategories.map(cropCategoryLabel);
  return {
    id: record.id,
    name: record.name,
    crop,
    status: "Good",
    ndvi: 0.72,
    soilFertility: "Medium",
    areaHa: Number((record.areaHa ?? 0).toFixed(2)),
    healthScore: 86,
    planted: formatDate(plantedSource),
    estHarvest: estimateHarvestDate(plantedSource),
    growthStage: growthStageFromPlantingDate(record.plantingDate),
    fieldType: fieldTypeLabel(record.fieldType),
    cropCategories: categories.length > 0 ? categories.join(", ") : "Not set",
    varieties: record.varieties.length > 0 ? record.varieties.join(", ") : "Not set",
    imageTint: colorForIndex(index),
    points: record.points,
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

export async function saveFieldBoundary(payload: FieldBoundaryPayload): Promise<FieldBoundaryRecord> {
  const { data } = await httpClient.post<FieldApiResponse>("/api/v1/fields/", {
    name: payload.name,
    crop_type: payload.cropType ?? null,
    planting_date: payload.plantingDate ?? null,
    field_type: payload.fieldType ?? null,
    crop_categories: payload.cropCategories ?? [],
    varieties: payload.varieties ?? [],
    area_ha: payload.areaHa ?? null,
    boundary: toGeoJsonPolygon(payload),
  });

  return toFieldBoundaryRecord(data);
}

export async function deleteFieldBoundary(fieldId: string): Promise<void> {
  await httpClient.delete(`/api/v1/fields/${fieldId}`);
}
