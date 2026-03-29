import axios from "axios";
import { Platform } from "react-native";

const API_BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";
const API_TIMEOUT_MS = 8000;
const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
});

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export type MeResponse = {
  id: string;
  email: string;
  display_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await http.post("/api/v1/auth/login", { email, password });
    return response.data;
  },

  async register(payload: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<void> {
    const displayName = `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim();
    await http.post("/api/v1/auth/register", {
      email: payload.email,
      password: payload.password,
      display_name: displayName,
    });
  },

  async me(accessToken: string): Promise<MeResponse> {
    const response = await http.get("/api/v1/auth/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  },
};
