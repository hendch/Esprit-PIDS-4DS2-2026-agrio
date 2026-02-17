import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { IrrigationScreen } from "./IrrigationScreen";

export const irrigationModule: FeatureModule = {
  id: "irrigation",
  routes: [{ name: Routes.Irrigation, component: IrrigationScreen, options: { title: "Irrigation", headerShown: false } }],
  dashboardEntry: {
    title: "Autonomous Irrigation",
    subtitle: "FAO-56-based recommendations & water savings",
    routeName: Routes.Irrigation,
    emoji: "💧",
  },
};
