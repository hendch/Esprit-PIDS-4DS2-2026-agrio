export const GREEN = "#4CAF50";
export const GREEN_LIGHT = "#E8F5E9";

export type ThemeColors = {
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryLight: string;
  headerBorder: string;
  tabBarBg: string;
  tabBarBorder: string;
  overlay: string;
  inputBg: string;
  severityHigh: string;
  severityMedium: string;
  severityLow: string;
};

export const lightColors: ThemeColors = {
  background: "#FAFAF8",
  card: "#FFFFFF",
  cardBorder: "#EEE",
  text: "#2C2C2C",
  textSecondary: "#666",
  primary: GREEN,
  primaryLight: GREEN_LIGHT,
  headerBorder: "#EEE",
  tabBarBg: "#FFF",
  tabBarBorder: "#EEE",
  overlay: "rgba(0,0,0,0.4)",
  inputBg: "#F0F0F0",
  severityHigh: "#E53935",
  severityMedium: "#FF9800",
  severityLow: "#2196F3",
};

export const darkColors: ThemeColors = {
  background: "#121212",
  card: "#1E1E1E",
  cardBorder: "#333",
  text: "#E8E8E8",
  textSecondary: "#B0B0B0",
  primary: "#66BB6A",
  primaryLight: "#2E7D32",
  headerBorder: "#333",
  tabBarBg: "#1E1E1E",
  tabBarBorder: "#333",
  overlay: "rgba(0,0,0,0.6)",
  inputBg: "#2C2C2C",
  severityHigh: "#EF5350",
  severityMedium: "#FFB74D",
  severityLow: "#64B5F6",
};
