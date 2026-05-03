import type {
  ForecastRequest,
  ForecastResponse,
  HistoryParams,
  PricePoint,
  Recommendation,
  SeriesInfo,
} from "./types";
import { httpClient } from "../../core/api/httpClient";

const BASE = `/api/v1/market-prices`;

export const marketPricesApi = {
  /** GET /series — summary info for all loaded series */
  listSeries: async (): Promise<SeriesInfo[]> => {
    const response = await httpClient.get<SeriesInfo[]>(`${BASE}/series`);
    return response.data;
  },

  /** GET /series/{series_name}/history */
  getHistory: async (
    seriesName: string,
    params: HistoryParams = {}
  ): Promise<PricePoint[]> => {
    const response = await httpClient.get<PricePoint[]>(
      `${BASE}/series/${seriesName}/history`,
      { params }
    );
    return response.data;
  },

  /** POST /forecast — run or return cached forecast */
  createForecast: async (body: ForecastRequest): Promise<ForecastResponse> => {
    const response = await httpClient.post<ForecastResponse>(`${BASE}/forecast`, body);
    return response.data;
  },

  /** GET /forecast/{series_name}/latest */
  getLatestForecast: async (seriesName: string): Promise<ForecastResponse> => {
    const response = await httpClient.get<ForecastResponse>(
      `${BASE}/forecast/${seriesName}/latest`
    );
    return response.data;
  },

  /** GET /forecast/{series_name}/scenarios */
  getScenarios: async (seriesName: string) => {
    const response = await httpClient.get(`${BASE}/forecast/${seriesName}/scenarios`);
    return response.data;
  },

  /** GET /series/{series_name}/recommendation */
  getRecommendation: async (seriesName: string, region = 'national'): Promise<Recommendation> => {
    const response = await httpClient.get<Recommendation>(
      `${BASE}/series/${seriesName}/recommendation`,
      { params: { region } }
    );
    return response.data;
  },
};
