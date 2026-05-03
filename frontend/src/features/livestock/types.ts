export interface Animal {
  id: string;
  farm_id: string;
  name: string;
  animal_type: 'bovin' | 'vache' | 'genisse' | 'ovin' | 'agneau' | 'taurillon' | 'caprin';
  breed: string | null;
  birth_date: string | null;
  tag_id: string | null;
  status: 'active' | 'sold' | 'deceased';
  purchase_price: number | null;
  purchase_date: string | null;
  age_months: number | null;
  market_series: string | null;
  created_at: string;
}

export interface HealthEvent {
  id: string;
  animal_id: string;
  event_type: 'vaccination' | 'treatment' | 'checkup' | 'injury' | 'illness' | 'other';
  description: string | null;
  event_date: string;
}

export interface MarketPrice {
  series_name: string;
  latest_price: number;
  unit: string;
  cagr_pct: number;
}

export interface AnimalCreate {
  farm_id: string;
  name: string;
  animal_type: string;
  breed?: string;
  birth_date?: string;
  tag_id?: string;
  status?: string;
  purchase_price?: number;
  purchase_date?: string;
}

export interface AnimalPnL {
  animal_id: string;
  animal_name: string;
  animal_type: string;
  purchase_price: number | null;
  purchase_date: string | null;
  purchase_price_source: 'manual' | 'estimated_from_date' | null;
  estimated_value: number | null;
  market_series: string | null;
  unit: string;
  slaughter_weight_kg: number | null;
  price_per_kg: number | null;
  ownership_months: number | null;
  monthly_bales: number;
  tbn_price_per_bale: number | null;
  monthly_feed_cost: number | null;
  total_feed_cost: number | null;
  is_dairy: boolean;
  milk_price_per_litre: number | null;
  litres_per_month: number | null;
  milk_revenue_per_month: number | null;
  total_milk_revenue: number | null;
  has_offspring_revenue: boolean;
  offspring_price_per_kg: number | null;
  offspring_weight_kg: number | null;
  offspring_per_year: number | null;
  offspring_revenue_per_year: number | null;
  total_offspring_revenue: number | null;
  gross_pnl: number | null;
  net_pnl: number | null;
  currency: string;
}

export interface HerdStats {
  total_animals: number;
  total_herd_value: number;
  avg_age_months: number | null;
  due_vaccination: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
}

export const ANIMAL_TYPES = [
  { value: 'bovin',     label: 'Bovin',     emoji: '🐄' },
  { value: 'vache',     label: 'Vache',     emoji: '🐄' },
  { value: 'genisse',   label: 'Génisse',   emoji: '🐄' },
  { value: 'ovin',      label: 'Ovin',      emoji: '🐑' },
  { value: 'agneau',    label: 'Agneau',    emoji: '🐑' },
  { value: 'taurillon', label: 'Taurillon', emoji: '🐂' },
  { value: 'caprin',    label: 'Caprin',    emoji: '🐐' },
];

export const HEALTH_EVENT_TYPES = [
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'treatment',   label: 'Traitement'  },
  { value: 'checkup',     label: 'Contrôle'    },
  { value: 'injury',      label: 'Blessure'    },
  { value: 'illness',     label: 'Maladie'     },
  { value: 'other',       label: 'Autre'       },
];
