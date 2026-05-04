import { httpClient, IRRIGATION_CHECK_TIMEOUT_MS } from "../../../core/api/httpClient";

export interface IrrigationDecisionResponse {
  decision: string;
}

export interface DashboardData {
  weather: any[] | null;
  moisture: {
    moisture_percent: number;
    status: string;
    history?: any[];
    mqtt_connected?: boolean;
    live?: boolean;
    topic?: string;
    waited_for_message?: boolean;
  } | null;
  usage_today: number | null;
  usage_history?: { history: any[]; water_saved_pct: number } | null;
}

export interface ScheduleRequest {
  field_id: string;
  target_date: string;
  start_time: string;
  duration_minutes: number;
  water_volume: number;
}

export type ScheduleStatus = "pending" | "doing" | "done" | "cancelled";

export interface Schedule {
  id: string;
  field_id: string;
  target_date: string;
  start_time: string;
  duration_minutes: number;
  water_volume: number;
  status: ScheduleStatus;
}

export const irrigationApi = {
  checkIrrigation: async (
    crop: string,
    lat: number,
    lon: number,
  ): Promise<IrrigationDecisionResponse> => {
    try {
      const response = await httpClient.post(
        "/api/v1/irrigation/check",
        { crop, lat, lon },
        { timeout: IRRIGATION_CHECK_TIMEOUT_MS },
      );
      return response.data;
    } catch (error) {
      console.error("Error checking irrigation API:", error);
      throw error;
    }
  },

  getDashboardData: async (): Promise<DashboardData> => {
    try {
      const response = await httpClient.get("/api/v1/irrigation/dashboard");
      return response.data;
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      throw error;
    }
  },

  createSchedule: async (data: ScheduleRequest): Promise<void> => {
    try {
      await httpClient.post("/api/v1/irrigation/schedule", data);
    } catch (error) {
      console.error("Error creating schedule:", error);
      throw error;
    }
  },

  cancelSchedule: async (scheduleId: string): Promise<void> => {
    try {
      await httpClient.delete(`/api/v1/irrigation/schedules/${scheduleId}`);
    } catch (error) {
      console.error("Error cancelling schedule:", error);
      throw error;
    }
  },

  getAutonomousState: async (): Promise<{ autonomous: boolean }> => {
    try {
      const response = await httpClient.get("/api/v1/irrigation/autonomous");
      return response.data;
    } catch (error) {
      console.error("Error fetching autonomous state:", error);
      throw error;
    }
  },

  setAutonomousState: async (autonomous: boolean): Promise<void> => {
    try {
      await httpClient.post("/api/v1/irrigation/autonomous", { autonomous });
    } catch (error) {
      console.error("Error setting autonomous state:", error);
      throw error;
    }
  },

  getSchedules: async (): Promise<{ schedules: Schedule[] }> => {
    try {
      const response = await httpClient.get("/api/v1/irrigation/schedules");
      return response.data;
    } catch (error) {
      console.error("Error fetching schedules:", error);
      throw error;
    }
  },
};