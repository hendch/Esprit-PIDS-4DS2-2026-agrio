export const Routes = {
  Login: "Login",
  SignUp: "SignUp",
  Dashboard: "Dashboard",
  Irrigation: "Irrigation",
  Satellite: "Satellite",
  FieldDetail: "FieldDetail",
  FieldBoundarySetup: "FieldBoundarySetup",
  DiseaseDetection: "DiseaseDetection",
  Livestock: "Livestock",
  Community: "Community",
  Alerts: "Alerts",
  FarmTrustLedger: "FarmTrustLedger",

  Messages: "Messages",
  UserSearch: "UserSearch",
  Chat: "Chat",

  MarketPrices: "MarketPrices",
  ProducePrices: "ProducePrices",
} as const;

export type RouteName = (typeof Routes)[keyof typeof Routes];
