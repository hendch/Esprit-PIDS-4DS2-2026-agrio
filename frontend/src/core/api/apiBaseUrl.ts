import { Platform } from "react-native";

/**
 * Emulator defaults (no env var needed if the API runs on your development machine):
 * - Android emulator: `10.0.2.2` reaches the host’s localhost (where uvicorn usually listens).
 * - iOS simulator / web: `localhost`.
 *
 * Set `EXPO_PUBLIC_API_BASE_URL` only if the backend is not on the host loopback (e.g. physical
 * device on LAN, or Docker-only IP). Restart Expo after changing env vars.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }
  return "http://localhost:8000";
}
