import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { LandScreen } from "./LandScreen";
import { FieldDetailScreen } from "./FieldDetailScreen";
import { FieldBoundarySetupScreen } from "./FieldBoundarySetupScreen";

export const satelliteModule: FeatureModule = {
  id: "satellite",
  routes: [
    { name: Routes.Satellite, component: LandScreen, options: { title: "Land Planning", headerShown: false } },
    { name: Routes.FieldDetail, component: FieldDetailScreen, options: { title: "Field", headerShown: false } },
    {
      name: Routes.FieldBoundarySetup,
      component: FieldBoundarySetupScreen,
      options: { title: "Field Border", headerShown: false },
    },
  ],
  dashboardEntry: {
    title: "Satellite Insights",
    subtitle: "Field zones, stress detection, VRA guidance",
    routeName: Routes.Satellite,
    emoji: "🛰️",
  },
};
