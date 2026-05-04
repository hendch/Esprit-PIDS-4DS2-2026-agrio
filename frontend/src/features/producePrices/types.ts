export interface ProduceProduct {
  product: string;
  category: 'fruit' | 'legume';
  display_name: string;
  unit: string;
  latest_date: string | null;
  latest_retail_price: number | null;
  latest_wholesale_price: number | null;
  weeks_of_data: number;
}

export interface ProduceForecastPoint {
  date: string;
  forecast: number;
  lower_80: number;
  upper_80: number;
  lower_95: number;
  upper_95: number;
}

export interface ProduceScenarioPoint {
  date: string;
  optimistic: number;
  baseline: number;
  pessimistic: number;
}

export interface ProduceForecastResult {
  product: string;
  category: string;
  best_model_name: string;
  generated_at: string;
  horizon_weeks: number;
  forecast: ProduceForecastPoint[];
  scenarios: ProduceScenarioPoint[];
  backtest_metrics: Record<string, Record<string, number>>;
  warnings: string[];
  cached?: boolean;
}
