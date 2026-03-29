import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { LoginScreen } from "./LoginScreen";
import { SignUpScreen } from "./SignUpScreen";

export const authModule: FeatureModule = {
  id: "auth",
  routes: [
    {
      name: Routes.Login,
      component: LoginScreen,
      options: { title: "Login", headerShown: false },
    },
    {
      name: Routes.SignUp,
      component: SignUpScreen,
      options: { title: "Sign Up", headerShown: false },
    },
  ],
};
