import { httpClient } from "../../core/api/httpClient";

export interface PriceAlert {
  id: string;
  user_id: string;
  series_name: string;
  condition: "above" | "below";
  threshold: number;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

export interface CreateAlertPayload {
  series_name: string;
  condition: "above" | "below";
  threshold: number;
}

export interface UpdateAlertPayload {
  threshold?: number;
  condition?: "above" | "below";
  is_active?: boolean;
}

export const SERIES_DISPLAY: Record<string, string> = {
  brebis_suitees: "Brebis suitées",
  genisses_pleines: "Génisses pleines",
  vaches_suitees: "Vaches suitées",
  viandes_rouges: "Viandes rouges",
  bovins_suivis: "Bovins suivis",
  vaches_gestantes: "Vaches gestantes",
  tbn: "Paille (التبن)",
  qrt: "Vesce (القرط)",
};

export const SERIES_UNIT: Record<string, string> = {
  brebis_suitees: "TND/head",
  genisses_pleines: "TND/head",
  vaches_suitees: "TND/head",
  viandes_rouges: "TND/kg",
  bovins_suivis: "TND/head",
  vaches_gestantes: "TND/head",
  tbn: "TND/bale",
  qrt: "TND/bale",
};

export const alertsApi = {
  getAlerts: async (): Promise<PriceAlert[]> => {
    const { data } = await httpClient.get("/api/v1/notifications/alerts");
    return data;
  },

  createAlert: async (payload: CreateAlertPayload): Promise<PriceAlert> => {
    const { data } = await httpClient.post(
      "/api/v1/notifications/alerts",
      payload
    );
    return data;
  },

  updateAlert: async (
    id: string,
    payload: UpdateAlertPayload
  ): Promise<PriceAlert> => {
    const { data } = await httpClient.put(
      `/api/v1/notifications/alerts/${id}`,
      payload
    );
    return data;
  },

  deleteAlert: async (id: string): Promise<void> => {
    await httpClient.delete(`/api/v1/notifications/alerts/${id}`);
  },

  checkNow: async (): Promise<{
    checked: number;
    triggered: number;
    errors: number;
  }> => {
    const { data } = await httpClient.post(
      "/api/v1/notifications/alerts/check-now"
    );
    return data;
  },
};
