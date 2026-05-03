import { create } from "zustand";

import { marketPricesApi } from "./api";
import type { ForecastResponse, PricePoint, Recommendation, SeriesInfo } from "./types";

interface MarketPricesState {
  // Series list
  series: SeriesInfo[];
  seriesLoading: boolean;
  seriesError: string | null;

  // Selected series & history
  selectedSeries: string;
  history: PricePoint[];
  historyLoading: boolean;
  historyError: string | null;

  // Forecasts keyed by region so switching regions shows cached results
  forecasts: Record<string, ForecastResponse>;
  forecastLoading: boolean;
  forecastError: string | null;

  // Recommendation
  recommendation: Recommendation | null;
  recommendationLoading: boolean;

  // Actions
  fetchSeries: () => Promise<void>;
  setSelectedSeries: (name: string) => void;
  fetchHistory: (seriesName: string, start?: string) => Promise<void>;
  fetchForecast: (seriesName: string, horizon?: number, forceRefresh?: boolean, region?: string) => Promise<void>;
  fetchRecommendation: (seriesName: string, region?: string) => Promise<void>;
}

export const useMarketPricesStore = create<MarketPricesState>((set) => ({
  series: [],
  seriesLoading: false,
  seriesError: null,

  selectedSeries: "brebis_suitees",
  history: [],
  historyLoading: false,
  historyError: null,

  forecasts: {},
  forecastLoading: false,
  forecastError: null,

  recommendation: null,
  recommendationLoading: false,

  fetchSeries: async () => {
    set({ seriesLoading: true, seriesError: null });
    try {
      const data = await marketPricesApi.listSeries();
      set({ series: data, seriesLoading: false });
    } catch (err: any) {
      set({
        seriesError: err?.message ?? "Failed to load series",
        seriesLoading: false,
      });
    }
  },

  setSelectedSeries: (name: string) => {
    set({ selectedSeries: name, history: [], forecasts: {}, recommendation: null, recommendationLoading: false });
  },

  fetchHistory: async (seriesName: string, start = "2020-01") => {
    set({ historyLoading: true, historyError: null });
    try {
      const data = await marketPricesApi.getHistory(seriesName, { start, region: "national" });
      set({ history: data, historyLoading: false });
    } catch (err: any) {
      set({
        historyError: err?.message ?? "Failed to load history",
        historyLoading: false,
      });
    }
  },

  fetchRecommendation: async (seriesName: string, region = "national") => {
    set({ recommendationLoading: true, recommendation: null });
    try {
      const rec = await marketPricesApi.getRecommendation(seriesName, region);
      set({ recommendation: rec });
    } catch (e) {
      console.error('Recommendation error:', e);
    } finally {
      set({ recommendationLoading: false });
    }
  },

  fetchForecast: async (seriesName: string, horizon = 12, forceRefresh = false, region = "national") => {
    set({ forecastLoading: true, forecastError: null });
    try {
      const data = await marketPricesApi.createForecast({
        series_name: seriesName,
        horizon,
        model: "auto",
        force_refresh: forceRefresh,
        region,
      });
      set((state) => ({
        forecasts: { ...state.forecasts, [region]: data },
        forecastLoading: false,
      }));
    } catch (err: any) {
      set({
        forecastError: err?.message ?? "Failed to run forecast",
        forecastLoading: false,
      });
    }
  },
}));
