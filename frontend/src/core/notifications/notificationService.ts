import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { httpClient } from "../api/httpClient";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function _getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice && !__DEV__) {
    console.log("[Push] Skipped — not a physical device");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  const finalStatus =
    existing === "granted"
      ? existing
      : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== "granted") {
    console.warn("[notifications] Permission not granted");
    return null;
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      "b30a28a5-e23e-4d4a-bdb2-2ff63a9dd121";

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    return token;
  } catch (e) {
    console.warn("[notifications] Failed to get push token:", e);
    return null;
  }
}

export async function registerPushToken(): Promise<boolean> {
  try {
    const token = await _getExpoPushToken();
    if (!token) return false;

    const platform = Platform.OS === "ios" ? "ios" : "android";
    await httpClient.post("/api/v1/notifications/device-token", {
      token,
      platform,
    });
    return true;
  } catch (e) {
    console.warn("[notifications] Token registration failed:", e);
    return false;
  }
}
