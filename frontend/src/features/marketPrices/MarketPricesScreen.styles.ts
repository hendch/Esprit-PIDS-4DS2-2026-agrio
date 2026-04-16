import { StyleSheet } from "react-native";

export const GREEN = "#4CAF50";
export const GREEN_LIGHT = "#E8F5E9";
export const BLUE = "#1E88E5";
export const BLUE_LIGHT = "#E3F2FD";
export const OFFSET_WHITE = "#FAFAF8";

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OFFSET_WHITE },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  hamburger: { fontSize: 22, color: "#2C2C2C" },
  headerCenter: { flexDirection: "row", alignItems: "center" },
  logoIcon: { fontSize: 24, marginRight: 6 },
  logoText: { fontSize: 20, fontWeight: "700", color: GREEN },
  headerRight: { fontSize: 14, color: "#666", fontWeight: "500" },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20 },

  // Page title
  pageTitle: { fontSize: 22, fontWeight: "800", color: "#2C2C2C", marginBottom: 4 },
  pageSubtitle: { fontSize: 13, color: "#666", marginBottom: 20 },

  // Series selector chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "#DDD",
  },
  chipActive: {
    backgroundColor: BLUE_LIGHT,
    borderColor: BLUE,
  },
  chipText: { fontSize: 12, color: "#555", fontWeight: "500" },
  chipTextActive: { color: BLUE, fontWeight: "700" },

  // Summary cards
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  summaryValue: { fontSize: 22, fontWeight: "800" },
  summaryLabel: { fontSize: 11, color: "#666", marginTop: 4, textAlign: "center" },

  // Section titles
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#2C2C2C", marginBottom: 12 },

  // History chart card
  chartCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  chartTitle: { fontSize: 14, fontWeight: "700", color: "#2C2C2C" },
  chartSubtitle: { fontSize: 12, color: "#888", marginTop: 2 },
  unitPill: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unitText: { fontSize: 11, color: "#666" },
  graphArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  graphBar: { backgroundColor: BLUE, borderRadius: 2 },
  graphXLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 2,
  },
  graphXLabel: { fontSize: 10, color: "#999" },

  // Forecast card
  forecastCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  forecastHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modelPill: {
    backgroundColor: GREEN_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  modelPillText: { fontSize: 11, fontWeight: "600", color: "#2E7D32" },
  forecastRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  forecastDate: { fontSize: 13, color: "#555", width: 70 },
  forecastValue: { fontSize: 14, fontWeight: "700", color: "#2C2C2C", flex: 1, textAlign: "center" },
  forecastRange: { fontSize: 11, color: "#888", width: 100, textAlign: "right" },

  // Trend summary
  trendCard: {
    backgroundColor: BLUE_LIGHT,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  trendTitle: { fontSize: 14, fontWeight: "700", color: "#1565C0", marginBottom: 10 },
  trendRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  trendIcon: { fontSize: 16, marginRight: 8 },
  trendText: { fontSize: 13, color: "#1E3A5F", flex: 1, lineHeight: 20 },

  // Loading / error
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  loadingText: { fontSize: 14, color: "#888", marginTop: 12 },
  errorText: { fontSize: 14, color: "#E53935", textAlign: "center", lineHeight: 22 },
  retryBtn: {
    marginTop: 16,
    backgroundColor: BLUE,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { fontSize: 14, fontWeight: "600", color: "#FFF" },

  // Run forecast button
  runForecastBtn: {
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  runForecastBtnText: { fontSize: 15, fontWeight: "700", color: "#FFF" },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 12,
    paddingHorizontal: 8,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  tabItem: { alignItems: "center", flex: 1 },
  tabIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  tabIconWrapActive: { backgroundColor: GREEN_LIGHT },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 10, color: "#666" },
  tabLabelActive: { color: GREEN, fontWeight: "600" },

  pressed: { opacity: 0.85 },
});
