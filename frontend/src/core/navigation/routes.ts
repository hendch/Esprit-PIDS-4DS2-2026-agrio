export const Routes = {
  Login: "Login",
  SignUp: "SignUp",
  Dashboard: "Dashboard",
  Irrigation: "Irrigation",
  Satellite: "Satellite",
  FieldDetail: "FieldDetail",
  DiseaseDetection: "DiseaseDetection",
  Livestock: "Livestock",
  Community: "Community",
  Alerts: "Alerts",
  FarmTrustLedger: "FarmTrustLedger",
  MarketPrices: "MarketPrices",
  ProducePrices: "ProducePrices",
  Settings: "Settings",
  Profile: "Profile",
} as const;

export type RouteName = (typeof Routes)[keyof typeof Routes];
