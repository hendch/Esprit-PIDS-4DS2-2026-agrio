import axios from "axios";
import { Platform } from "react-native";

import type {
  ForecastRequest,
  ForecastResponse,
  HistoryParams,
  PricePoint,
  SeriesInfo,
} from "./types";

const API_BASE_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:8000"   // Android emulator → host loopback
    : "http://localhost:8000";  // iOS simulator / web

const BASE = `${API_BASE_URL}/api/v1/market-prices`;

export const marketPricesApi = {
  /** GET /series — summary info for all loaded series */
  listSeries: async (): Promise<SeriesInfo[]> => {
    const response = await axios.get<SeriesInfo[]>(`${BASE}/series`);
    return response.data;
  },

  /** GET /series/{series_name}/history */
  getHistory: async (
    seriesName: string,
    params: HistoryParams = {}
  ): Promise<PricePoint[]> => {
    const response = await axios.get<PricePoint[]>(
      `${BASE}/series/${seriesName}/history`,
      { params }
    );
    return response.data;
  },

  /** POST /forecast — run or return cached forecast */
  createForecast: async (body: ForecastRequest): Promise<ForecastResponse> => {
    const response = await axios.post<ForecastResponse>(`${BASE}/forecast`, body);
    return response.data;
  },

  /** GET /forecast/{series_name}/latest */
  getLatestForecast: async (seriesName: string): Promise<ForecastResponse> => {
    const response = await axios.get<ForecastResponse>(
      `${BASE}/forecast/${seriesName}/latest`
    );
    return response.data;
  },

  /** GET /forecast/{series_name}/scenarios */
  getScenarios: async (seriesName: string) => {
    const response = await axios.get(`${BASE}/forecast/${seriesName}/scenarios`);
    return response.data;
  },
};
