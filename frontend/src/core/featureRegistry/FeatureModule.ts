import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import type { ComponentType } from "react";

export type FeatureRoute = {
  name: string; // unique route name
  component: ComponentType<any>;
  options?: NativeStackNavigationOptions;
};

export type DashboardEntry = {
  title: string;
  subtitle?: string;
  routeName: string; // must match a registered route name
  emoji?: string; // keep it simple for now
};

export type FeatureModule = {
  id: string; // unique feature id
  routes: FeatureRoute[];
  dashboardEntry?: DashboardEntry; // if present, it shows on dashboard
  init?: () => Promise<void> | void; // optional startup work (db, models, etc.)
};
