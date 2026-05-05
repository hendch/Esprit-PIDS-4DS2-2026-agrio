import { httpClient } from "../../../core/api/httpClient";

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
    const response = await httpClient.post("/api/v1/auth/login", { email, password });
    return response.data;
  },

  async register(payload: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<LoginResponse> {
    const displayName = `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim();
    const response = await httpClient.post("/api/v1/auth/register", {
      email: payload.email,
      password: payload.password,
      display_name: displayName,
    });

    return response.data;
  },

  /** Requires `accessToken` in the user store (set after login). */
  async me(): Promise<MeResponse> {
    const response = await httpClient.get("/api/v1/auth/me");
    return response.data;
  },
};
