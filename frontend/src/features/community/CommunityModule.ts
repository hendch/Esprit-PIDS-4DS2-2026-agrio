import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { CommunityScreen } from "./CommunityScreen";

export const communityModule: FeatureModule = {
  id: "community",
  routes: [
    { name: Routes.Community, component: CommunityScreen, options: { title: "Community", headerShown: false } },
  ],
};
