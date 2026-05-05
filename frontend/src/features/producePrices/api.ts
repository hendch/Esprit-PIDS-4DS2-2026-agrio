import { httpClient } from "../../core/api/httpClient";
import type { ProduceForecastResult, ProduceProduct } from "./types";

const BASE = `/api/v1/produce-prices`;

export const producePricesApi = {
  getProducts: async (): Promise<ProduceProduct[]> => {
    const response = await httpClient.get<ProduceProduct[]>(`${BASE}/products`);
    return response.data;
  },

  getHistory: async (
    product: string,
    params?: { start?: string; end?: string }
  ) => {
    const response = await httpClient.get(`${BASE}/products/${product}/history`, { params });
    return response.data;
  },

  requestForecast: async (body: {
    product: string;
    horizon?: number;
    force_refresh?: boolean;
  }): Promise<ProduceForecastResult> => {
    const response = await httpClient.post<ProduceForecastResult>(`${BASE}/forecast`, body);
    return response.data;
  },

  getLatestForecast: async (product: string): Promise<ProduceForecastResult> => {
    const response = await httpClient.get<ProduceForecastResult>(
      `${BASE}/forecast/${product}/latest`
    );
    return response.data;
  },

  batchForecast: async (products: string[], horizon = 12) => {
    const response = await httpClient.post(`${BASE}/forecast/batch`, { products, horizon });
    return response.data;
  },
};
