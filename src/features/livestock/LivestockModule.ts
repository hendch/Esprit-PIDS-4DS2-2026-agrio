import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { LivestockScreen } from "./LivestockScreen";

export const livestockModule: FeatureModule = {
  id: "livestock",
  routes: [{ name: Routes.Livestock, component: LivestockScreen, options: { title: "Livestock", headerShown: false } }],
  dashboardEntry: {
    title: "Livestock Management",
    subtitle: "Health records, alerts, and sustainability tracking",
    routeName: Routes.Livestock,
    emoji: "🐄",
  },
};
