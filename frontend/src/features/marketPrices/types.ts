/**
 * TypeScript interfaces for the Market Prices feature.
 * Mirrors the Pydantic schemas in backend/app/api/v1/market_prices/schemas.py.
 */

export interface RegionPrices {
  nord: number | null;
  sahel: number | null;
  centre_et_sud: number | null;
}

export interface SeriesInfo {
  series_name: string;
  description: string;
  unit: string;
  latest_date: string;
  latest_price: number;
  cagr_pct: number;
  regions: RegionPrices;
  category?: 'livestock' | 'fodder';
}

export interface PricePoint {
  date: string;
  price: number;
  region: string;
}

export interface ForecastPoint {
  date: string;
  forecast: number;
  lower_80: number;
  upper_80: number;
  lower_95: number;
  upper_95: number;
}

export interface ScenarioPoint {
  date: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
}

export interface ForecastResponse {
  series_name: string;
  region: string;
  generated_at: string;
  model_used: string;
  horizon: number;
  forecast: ForecastPoint[];
  scenarios: ScenarioPoint[];
}

export interface ForecastRequest {
  series_name: string;
  horizon?: number;
  model?: "auto" | "sarima" | "seasonal_naive";
  force_refresh?: boolean;
  region?: string;
}

export interface HistoryParams {
  start?: string;   // YYYY-MM
  end?: string;     // YYYY-MM
  region?: string;  // national | nord | sahel | centre_et_sud
}

export interface MonthRecommendation {
  date: string;
  month_label: string;
  forecast_price: number;
  lower_95: number;
  upper_95: number;
  pct_above_current?: number;
  pct_below_current?: number;
}

export interface Recommendation {
  series_name: string;
  unit: string;
  action: 'wait' | 'neutral';
  best_month: MonthRecommendation;
  worst_month: MonthRecommendation;
  sell_advice: string;
  avoid_advice: string | null;
  generated_from: string;
}

export const SERIES_DISPLAY: Record<string, { label: string; category: 'livestock' | 'fodder' }> = {
  brebis_suitees:   { label: 'Brebis suitées',  category: 'livestock' },
  genisses_pleines: { label: 'Génisses pleines', category: 'livestock' },
  vaches_suitees:   { label: 'Vaches suitées',   category: 'livestock' },
  viandes_rouges:   { label: 'Viandes rouges',   category: 'livestock' },
  bovins_suivis:    { label: 'Bovins suivis',     category: 'livestock' },
  vaches_gestantes: { label: 'Vaches gestantes', category: 'livestock' },
  tbn:              { label: 'Paille (التبن)',    category: 'fodder'    },
  qrt:              { label: 'Vesce (القرط)',     category: 'fodder'    },
};
