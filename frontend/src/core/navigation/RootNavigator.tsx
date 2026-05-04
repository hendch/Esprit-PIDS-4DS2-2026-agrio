import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { featureRegistry } from "../featureRegistry/FeatureRegistry";
import { useUserStore } from "../userStore/userStore";
import { Routes } from "./routes";

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const routes = featureRegistry.listRoutes();
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const allowedRouteNames: Set<string> = isAuthenticated
    ? new Set(
        Object.values(Routes).filter(
          (routeName) => routeName !== Routes.Login && routeName !== Routes.SignUp,
        ),
      )
    : new Set([Routes.Login, Routes.SignUp]);
  const filteredRoutes = routes.filter((route) => (allowedRouteNames as Set<string>).has(route.name as string));

  return (
    <Stack.Navigator initialRouteName={isAuthenticated ? Routes.Dashboard : Routes.Login}>
      {filteredRoutes.map((r) => (
        <Stack.Screen key={r.name} name={r.name} component={r.component} options={r.options} />
      ))}
    </Stack.Navigator>
  );
}
