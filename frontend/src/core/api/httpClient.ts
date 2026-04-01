import axios from "axios";

import { useUserStore } from "../userStore/userStore";

import { getApiBaseUrl } from "./apiBaseUrl";

/** Default for typical API calls (auth, dashboard, etc.). */
export const API_TIMEOUT_MS = 30_000;

/** Irrigation `/check` runs the LLM agent on the server and often exceeds the default. */
export const IRRIGATION_CHECK_TIMEOUT_MS = 120_000;

export const httpClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: API_TIMEOUT_MS,
});

httpClient.interceptors.request.use((config) => {
  const token = useUserStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
