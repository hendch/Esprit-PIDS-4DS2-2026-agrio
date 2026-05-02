export const CROP_OPTIONS = [
  { label: "Wheat", value: "wheat", category: "cereals" },
  { label: "Barley", value: "barley", category: "cereals" },
  { label: "Olive", value: "olive", category: "orchards" },
  { label: "Tomato", value: "tomato", category: "vegetables" },
  { label: "Potato", value: "potato", category: "vegetables" },
  { label: "Citrus", value: "citrus", category: "orchards" },
  { label: "Grapes", value: "grapes", category: "vineyards" },
  { label: "Strawberry", value: "strawberry", category: "berries" },
  { label: "Lettuce", value: "lettuce", category: "leafy_greens" },
  { label: "Pepper", value: "pepper", category: "vegetables" },
];

export const CROP_CATEGORY_OPTIONS = [
  { label: "Cereals", value: "cereals" },
  { label: "Vegetables", value: "vegetables" },
  { label: "Orchards", value: "orchards" },
  { label: "Vineyards", value: "vineyards" },
  { label: "Berries", value: "berries" },
  { label: "Leafy greens", value: "leafy_greens" },
  { label: "Legumes", value: "legumes" },
  { label: "Forage", value: "forage" },
];

export const FIELD_TYPE_OPTIONS = [
  { label: "Rows", value: "rows" },
  { label: "Open field", value: "open_field" },
  { label: "Greenhouse", value: "greenhouse" },
];

export type GrowthStage = "Not planted" | "Establishment" | "Vegetative" | "Flowering" | "Maturity";

export function cropLabel(value?: string): string {
  const option = CROP_OPTIONS.find((crop) => crop.value === value);
  return option?.label ?? "Unassigned crop";
}

export function cropCategoryLabel(value?: string): string {
  const option = CROP_CATEGORY_OPTIONS.find((category) => category.value === value);
  return option?.label ?? value ?? "Unassigned";
}

export function fieldTypeLabel(value?: string): string {
  const option = FIELD_TYPE_OPTIONS.find((fieldType) => fieldType.value === value);
  return option?.label ?? "Not set";
}

export function growthStageFromPlantingDate(value?: string): GrowthStage {
  if (!value) {
    return "Not planted";
  }

  const plantedAt = new Date(value);
  if (Number.isNaN(plantedAt.getTime())) {
    return "Not planted";
  }

  const days = Math.max(0, Math.floor((Date.now() - plantedAt.getTime()) / 86_400_000));
  if (days < 21) return "Establishment";
  if (days < 55) return "Vegetative";
  if (days < 90) return "Flowering";
  return "Maturity";
}
