import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { AlertsScreen } from "./AlertsScreen";

export const alertsModule: FeatureModule = {
  id: "alerts",
  routes: [
    { name: Routes.Alerts, component: AlertsScreen, options: { title: "Alerts", headerShown: false } },
  ],
};
