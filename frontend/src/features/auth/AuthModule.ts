import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { LoginScreen } from "./LoginScreen";

export const authModule: FeatureModule = {
  id: "auth",
  routes: [
    {
      name: Routes.Login,
      component: LoginScreen,
      options: { title: "Login", headerShown: false },
    },
  ],
};
