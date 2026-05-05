import { create } from "zustand";

import { producePricesApi } from "./api";
import type { ProduceForecastResult, ProduceProduct } from "./types";

interface ProducePricesState {
  products: ProduceProduct[];
  selectedProduct: ProduceProduct | null;
  forecasts: Record<string, ProduceForecastResult>;
  loading: boolean;
  error: string | null;

  fetchProducts: () => Promise<void>;
  selectProduct: (product: ProduceProduct | null) => void;
  fetchForecast: (product: string, forceRefresh?: boolean) => Promise<void>;
  clearError: () => void;
}

export const useProducePricesStore = create<ProducePricesState>((set) => ({
  products: [],
  selectedProduct: null,
  forecasts: {},
  loading: false,
  error: null,

  fetchProducts: async () => {
    set({ loading: true, error: null });
    try {
      const data = await producePricesApi.getProducts();
      set({ products: data, loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? "Failed to load products", loading: false });
    }
  },

  selectProduct: (product) => {
    set({ selectedProduct: product });
  },

  fetchForecast: async (product: string, forceRefresh = false) => {
    set({ loading: true, error: null });
    try {
      const data = await producePricesApi.requestForecast({
        product,
        horizon: 220,
        force_refresh: forceRefresh,
      });
      set((state) => ({
        forecasts: { ...state.forecasts, [product]: data },
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err?.message ?? "Failed to run forecast", loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
