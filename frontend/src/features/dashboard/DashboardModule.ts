import { DashboardScreen } from "./DashboardScreen";
import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";

export const dashboardModule: FeatureModule = {
  id: "dashboard",
  routes: [
    {
      name: Routes.Dashboard,
      component: DashboardScreen,
      options: { title: "AGRIO", headerShown: false },
    },
  ],
};
