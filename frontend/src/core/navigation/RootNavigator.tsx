import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { featureRegistry } from "../featureRegistry/FeatureRegistry";

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const routes = featureRegistry.listRoutes();

  return (
    <Stack.Navigator initialRouteName="Login">
      {routes.map((r) => (
        <Stack.Screen key={r.name} name={r.name} component={r.component} options={r.options} />
      ))}
    </Stack.Navigator>
  );
}
