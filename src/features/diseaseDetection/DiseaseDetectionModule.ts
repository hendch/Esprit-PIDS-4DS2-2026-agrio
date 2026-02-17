import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { DiseaseDetectionScreen } from "./DiseaseDetectionScreen";

export const diseaseDetectionModule: FeatureModule = {
  id: "diseaseDetection",
  routes: [
    { name: Routes.DiseaseDetection, component: DiseaseDetectionScreen, options: { title: "Crop Health", headerShown: false } },
  ],
  dashboardEntry: {
    title: "Disease Detection",
    subtitle: "Instant diagnosis — works offline",
    routeName: Routes.DiseaseDetection,
    emoji: "🌿",
  },
};
