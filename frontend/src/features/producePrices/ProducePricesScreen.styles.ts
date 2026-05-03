import { StyleSheet } from "react-native";

export const GREEN = "#4CAF50";
export const GREEN_DARK = "#2d7a2d";
export const GREEN_LIGHT = "#E8F5E9";
export const BLUE = "#1E88E5";
export const BLUE_LIGHT = "#E3F2FD";
export const OFFSET_WHITE = "#FAFAF8";
export const YELLOW_LIGHT = "#FFFDE7";

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

  // Category toggle
  categoryRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  categoryPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#DDD",
    backgroundColor: "#F5F5F5",
  },
  categoryPillActive: {
    backgroundColor: BLUE_LIGHT,
    borderColor: BLUE,
  },
  categoryPillText: { fontSize: 14, fontWeight: "600", color: "#666" },
  categoryPillTextActive: { color: BLUE, fontWeight: "700" },

  // Section titles
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#2C2C2C", marginBottom: 12 },

  // Product cards (horizontal scroll)
  productCard: {
    width: 160,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: "#EEE",
  },
  productCardSelected: {
    borderColor: BLUE,
    backgroundColor: BLUE_LIGHT,
  },
  productCardName: { fontSize: 14, fontWeight: "700", color: "#2C2C2C", marginBottom: 6 },
  productCardPrice: { fontSize: 13, fontWeight: "600", color: BLUE, marginBottom: 6 },
  productCardWeeks: { fontSize: 11, color: "#999", marginTop: 4 },

  // Season badges
  badgeInSeason: {
    alignSelf: "flex-start",
    backgroundColor: GREEN_DARK,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  badgeInSeasonText: { fontSize: 10, fontWeight: "700", color: "#FFF" },
  badgeOffSeason: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#BBB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  badgeOffSeasonText: { fontSize: 10, fontWeight: "600", color: "#888" },

  // Selected product detail card
  detailCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  detailPriceRow: { flexDirection: "row", gap: 16, marginBottom: 12 },
  detailPriceBlock: { flex: 1 },
  detailPriceValue: { fontSize: 20, fontWeight: "800", color: BLUE },
  detailPriceLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  detailMeta: { fontSize: 12, color: "#666", marginTop: 6 },

  // Auto-forecast loading row (replaces the old green button)
  forecastGenerating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
    paddingVertical: 4,
  },
  forecastGeneratingText: { fontSize: 13, color: "#888" },
  slowWarning: { fontSize: 12, color: "#888", textAlign: "center", marginBottom: 16 },

  // Forecast table card
  forecastCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  forecastCardTitle: { fontSize: 14, fontWeight: "700", color: "#2C2C2C", marginBottom: 2 },
  forecastCardSubtitle: { fontSize: 12, color: "#888", marginBottom: 14 },
  forecastRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  forecastDate: { fontSize: 13, color: "#555", width: 80 },
  forecastValue: { fontSize: 14, fontWeight: "700", color: "#2C2C2C", flex: 1, textAlign: "center" },
  forecastRange: { fontSize: 11, color: "#888", width: 120, textAlign: "right" },

  // Scenarios
  scenarioCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  scenarioTitle: { fontSize: 14, fontWeight: "700", color: "#2C2C2C", marginBottom: 12 },
  scenarioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  scenarioLabel: { fontSize: 13, color: "#555", flex: 1 },
  scenarioValue: { fontSize: 14, fontWeight: "700", color: "#2C2C2C" },

  // Backtest metrics
  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  metricsCard: {
    flex: 1,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  metricsValue: { fontSize: 18, fontWeight: "800", color: GREEN_DARK },
  metricsLabel: { fontSize: 11, color: "#555", marginTop: 2 },
  metricsNote: { fontSize: 11, color: "#999", textAlign: "center", marginBottom: 24 },

  // Warning box
  warningBox: {
    backgroundColor: YELLOW_LIGHT,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#FBC02D",
  },
  warningText: { fontSize: 12, color: "#5D4037", lineHeight: 18 },

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
});
