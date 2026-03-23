import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Routes } from "../../core/navigation/routes";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useTheme } from "../../core/theme/useTheme";

const OFFSET_WHITE = "#FAFAF8";
const GREEN = "#4CAF50";
const GREEN_LIGHT = "#E8F5E9";

const CATTLE = [
  { id: "C001", name: "Bessie", status: "Good", breed: "Holstein", weight: "650 kg", age: "4 years", temp: "38.5°C", location: "Pasture A", imageTint: "#8D6E63" },
  { id: "C002", name: "Daisy", status: "Good", breed: "Jersey", weight: "480 kg", age: "3 years", temp: "38.2°C", location: "Pasture A", imageTint: "#A1887F" },
  { id: "C012", name: "Thunder", status: "Warning", breed: "Angus", weight: "720 kg", age: "5 years", temp: "39.2°C", location: "Pasture B", imageTint: "#5D4037" },
];

const MARKET_DATA = [2200, 2350, 2280, 2450, 2500, 2680];
const MARKET_LABELS = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"];

function TabBar({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabs = [
    { key: "Home", icon: "🏠", route: Routes.Dashboard },
    { key: "Land", icon: "🗺️", route: Routes.Satellite },
    { key: "Crop", icon: "🌱", route: Routes.DiseaseDetection },
    { key: "Water", icon: "💧", route: Routes.Irrigation },
    { key: "Livestock", icon: "🐄", route: Routes.Livestock },
    { key: "Community", icon: "👥", route: Routes.Community },
    { key: "Alerts", icon: "🔔", route: Routes.Alerts },
  ];
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 8 }]}>
      {tabs.map((t) => (
        <Pressable key={t.key} onPress={() => nav.navigate(t.route)} style={styles.tabItem}>
          <View style={[styles.tabIconWrap, active === t.key && styles.tabIconWrapActive]}>
            <Text style={styles.tabIcon}>{t.icon}</Text>
          </View>
          <Text style={[styles.tabLabel, active === t.key && styles.tabLabelActive]}>{t.key}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function LivestockScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const graphWidth = width - 24 * 2 - 24;
  const graphHeight = 100;
  const minVal = Math.min(...MARKET_DATA);
  const maxVal = Math.max(...MARKET_DATA);
  const range = maxVal - minVal || 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.headerBorder }]}>
        <TouchableOpacity onPress={() => useDrawerStore.getState().openDrawer()}>
          <Text style={styles.hamburger}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>Agrio</Text>
        </View>
        <Text style={styles.headerRight}>Livestock</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: "#FF9800" }]}>24</Text>
            <Text style={styles.summaryLabel}>Total Head</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: GREEN }]}>23</Text>
            <Text style={styles.summaryLabel}>Healthy</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: "#E53935" }]}>1</Text>
            <Text style={styles.summaryLabel}>Alert</Text>
          </View>
        </View>

        {/* Elevated Temperature Alert */}
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <Text style={styles.alertIcon}>🌡️</Text>
            <Text style={styles.alertTitle}>Elevated Temperature</Text>
            <View style={styles.cattleTag}>
              <Text style={styles.cattleTagText}>Cattle #C012</Text>
            </View>
          </View>
          <Text style={styles.alertDesc}>Thunder showing temperature of 39.2°C. Veterinary consultation advised.</Text>
          <Pressable style={({ pressed }) => [styles.alertBtn, pressed && styles.pressed]}>
            <Text style={styles.alertBtnText}>Contact Veterinarian</Text>
          </Pressable>
        </View>

        {/* Cattle Registry */}
        <Text style={styles.sectionTitle}>Cattle Registry</Text>
        {CATTLE.map((c) => (
          <View key={c.id} style={styles.cattleCard}>
            <View style={[styles.cattleImage, { backgroundColor: c.imageTint }]} />
            <View style={styles.cattleBody}>
              <View style={styles.cattleNameRow}>
                <Text style={styles.cattleName}>{c.name}</Text>
                <View style={[styles.statusTag, c.status === "Warning" && styles.statusTagWarning]}>
                  <Text style={styles.statusTagText}>{c.status}</Text>
                </View>
              </View>
              <Text style={styles.cattleId}>ID: {c.id}</Text>
              <Text style={styles.cattleDetail}>Breed: {c.breed}</Text>
              <Text style={styles.cattleDetail}>Weight: {c.weight}</Text>
              <Text style={styles.cattleDetail}>Age: {c.age}</Text>
              <Text style={styles.cattleDetail}>Temperature: {c.temp}</Text>
              <Text style={styles.cattleDetail}>📍 {c.location}</Text>
              <Text style={styles.cattleDetail}>✏️ Up to date</Text>
            </View>
          </View>
        ))}

        {/* Daily Consumption */}
        <Text style={styles.sectionTitle}>Daily Consumption</Text>
        <View style={styles.consumptionRow}>
          <View style={styles.consumptionCard}>
            <Text style={styles.consumptionIcon}>🍎</Text>
            <Text style={styles.consumptionValue}>380 kg</Text>
            <Text style={styles.consumptionSub}>15.8 kg per head</Text>
          </View>
          <View style={styles.consumptionCard}>
            <Text style={styles.consumptionIcon}>💧</Text>
            <Text style={styles.consumptionValue}>1,680 L</Text>
            <Text style={styles.consumptionSub}>70 L per head</Text>
          </View>
        </View>

        {/* Market Value Trend */}
        <Text style={styles.sectionTitle}>Market Value Trend</Text>
        <View style={styles.marketCard}>
          <View style={styles.marketHeader}>
            <View>
              <Text style={styles.marketLabel}>Current Avg Value</Text>
              <Text style={styles.marketValue}>$2,680</Text>
              <Text style={styles.marketTrend}>📈 +21.8% from Aug</Text>
            </View>
            <View style={styles.aiPill}>
              <Text style={styles.aiPillText}>AI Prediction: Stable</Text>
            </View>
          </View>
          <View style={[styles.graphArea, { width: graphWidth, height: graphHeight }]}>
            {MARKET_DATA.map((val, i) => (
              <View
                key={i}
                style={[
                  styles.graphBar,
                  {
                    width: Math.max(4, graphWidth / MARKET_DATA.length - 6),
                    height: Math.max(8, ((val - minVal) / range) * (graphHeight - 16) + 8),
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.graphXLabels}>
            {MARKET_LABELS.map((l) => (
              <Text key={l} style={styles.graphXLabel}>{l}</Text>
            ))}
          </View>
          <View style={styles.aiSuggestion}>
            <Text style={styles.aiSuggestionText}>AI Suggestion: Market conditions favorable for next 2-3 months. Consider holding inventory.</Text>
          </View>
        </View>

        {/* Health Monitoring */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Health Monitoring</Text>
            <Text style={styles.sectionIcon}>⚡</Text>
          </View>
          <View style={styles.healthCard}>
            <View style={styles.healthRow}>
              <Text style={styles.healthIcon}>📅</Text>
              <Text style={styles.healthText}>Next vaccination round: Feb 8, 2026</Text>
            </View>
            <View style={styles.healthRow}>
              <Text style={styles.healthIcon}>📅</Text>
              <Text style={styles.healthText}>Next vet visit: Feb 5, 2026</Text>
            </View>
            <Pressable style={({ pressed }) => [styles.scheduleBtn, pressed && styles.pressed]}>
              <Text style={styles.scheduleBtnText}>Schedule Checkup</Text>
            </Pressable>
          </View>
        </View>

        {/* Live Monitoring */}
        <Text style={styles.sectionTitle}>Live Monitoring</Text>
        <View style={styles.liveCard}>
          <View style={[styles.liveImage, { height: width * 0.45, backgroundColor: "#81C784" }]}>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>📍 Pasture A</Text>
            </View>
            <View style={[styles.liveBadge, styles.liveBadgeRight]}>
              <Text style={styles.liveBadgeText}>All Systems Normal</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <TabBar active="Livestock" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OFFSET_WHITE },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: OFFSET_WHITE,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  hamburger: { fontSize: 22, color: "#2C2C2C" },
  headerCenter: { flexDirection: "row", alignItems: "center" },
  logoIcon: { fontSize: 24, marginRight: 6 },
  logoText: { fontSize: 20, fontWeight: "700", color: GREEN },
  headerRight: { fontSize: 14, color: "#666", fontWeight: "500" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20 },
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
  summaryValue: { fontSize: 28, fontWeight: "800" },
  summaryLabel: { fontSize: 12, color: "#666", marginTop: 4 },
  alertCard: {
    backgroundColor: "#FFF8E1",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#FF9800",
  },
  alertHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  alertIcon: { fontSize: 22, marginRight: 8 },
  alertTitle: { fontSize: 16, fontWeight: "700", color: "#2C2C2C", flex: 1 },
  cattleTag: { backgroundColor: "#EFEBE9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  cattleTagText: { fontSize: 12, color: "#5D4037", fontWeight: "600" },
  alertDesc: { fontSize: 14, color: "#555", lineHeight: 22, marginBottom: 14 },
  alertBtn: { backgroundColor: "#FF9800", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  alertBtnText: { fontSize: 14, fontWeight: "600", color: "#FFF" },
  pressed: { opacity: 0.9 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C", marginBottom: 12 },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionIcon: { fontSize: 18 },
  section: { marginBottom: 24 },
  cattleCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  cattleImage: { width: 100, height: 120 },
  cattleBody: { flex: 1, padding: 14 },
  cattleNameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cattleName: { fontSize: 16, fontWeight: "700", color: "#2C2C2C" },
  statusTag: { backgroundColor: GREEN, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTagWarning: { backgroundColor: "#FF9800" },
  statusTagText: { fontSize: 11, fontWeight: "600", color: "#FFF" },
  cattleId: { fontSize: 12, color: "#666", marginBottom: 8 },
  cattleDetail: { fontSize: 12, color: "#555", marginBottom: 2 },
  consumptionRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  consumptionCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  consumptionIcon: { fontSize: 32, marginBottom: 8 },
  consumptionValue: { fontSize: 22, fontWeight: "700", color: "#2C2C2C" },
  consumptionSub: { fontSize: 12, color: "#666", marginTop: 4 },
  marketCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  marketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  marketLabel: { fontSize: 12, color: "#666" },
  marketValue: { fontSize: 24, fontWeight: "800", color: "#2C2C2C" },
  marketTrend: { fontSize: 13, color: GREEN, marginTop: 4 },
  aiPill: { backgroundColor: GREEN_LIGHT, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  aiPillText: { fontSize: 12, fontWeight: "600", color: "#2E7D32" },
  graphArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  graphBar: { backgroundColor: "#2196F3", borderRadius: 2 },
  graphXLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingHorizontal: 4 },
  graphXLabel: { fontSize: 11, color: "#666" },
  aiSuggestion: { marginTop: 16, backgroundColor: "#E8F5E9", padding: 14, borderRadius: 10 },
  aiSuggestionText: { fontSize: 13, color: "#2E7D32", lineHeight: 20 },
  healthCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  healthRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  healthIcon: { fontSize: 18, marginRight: 10 },
  healthText: { fontSize: 14, color: "#2C2C2C" },
  scheduleBtn: {
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  scheduleBtnText: { fontSize: 14, fontWeight: "600", color: "#FFF" },
  liveCard: { marginBottom: 24 },
  liveImage: { borderRadius: 16, overflow: "hidden", position: "relative" },
  liveBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: GREEN,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  liveBadgeRight: { left: undefined, right: 12 },
  liveBadgeText: { fontSize: 13, fontWeight: "600", color: "#FFF" },
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
