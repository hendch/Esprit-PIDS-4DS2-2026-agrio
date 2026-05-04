import { httpClient } from "../../core/api/httpClient";

export type FertilizerRecommendation = {
  field_id: string;
  crop: string;
  crop_group: string;
  formula: string;
  confidence: number | null;
  area_ha: number;
  target_yield_t_ha: number;
  fertilizer_kg_per_ha: number;
  total_fertilizer_kg: number;
  nutrient_need_kg_ha: Record<string, number>;
  explanation: string;
};

export async function getFertilizerRecommendation(
  fieldId: string,
  targetYieldTHa = 4,
): Promise<FertilizerRecommendation> {
  const { data } = await httpClient.post<FertilizerRecommendation>(
    `/api/v1/fertilizer/recommendations/${fieldId}`,
    {
      target_yield_t_ha: targetYieldTHa,
    },
  );

  return data;
}
