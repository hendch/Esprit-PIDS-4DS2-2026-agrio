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
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Routes } from "../../core/navigation/routes";
import { useTheme } from "../../core/theme/useTheme";

const OFFSET_WHITE = "#FAFAF8";
const GREEN = "#4CAF50";
const GREEN_LIGHT = "#E8F5E9";


const MOCK_FIELDS: Record<string, { name: string; crop: string; status: string; ndvi: number; soilFertility: string; areaHa: number; healthScore: number; planted: string; estHarvest: string; imageTint: string }> = {
  A1: {
    name: "Field A1",
    crop: "Corn",
    status: "Good",
    ndvi: 0.78,
    soilFertility: "High",
    areaHa: 12.4,
    healthScore: 92,
    planted: "Mar 15, 2026",
    estHarvest: "Aug 20, 2026",
    imageTint: "#81C784",
  },
  A2: {
    name: "Field A2",
    crop: "Wheat",
    status: "Warning",
    ndvi: 0.62,
    soilFertility: "Medium",
    areaHa: 9.8,
    healthScore: 78,
    planted: "Mar 10, 2026",
    estHarvest: "Jul 15, 2026",
    imageTint: "#DCE775",
  },
  B2: {
    name: "Field B2",
    crop: "Corn",
    status: "Poor",
    ndvi: 0.48,
    soilFertility: "Low",
    areaHa: 11.6,
    healthScore: 65,
    planted: "Mar 18, 2026",
    estHarvest: "Aug 25, 2026",
    imageTint: "#A1887F",
  },
};

function statusColor(s: string): string {
  if (s === "Good") return "#4CAF50";
  if (s === "Warning") return "#FF9800";
  return "#E53935";
}

function TabBar({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabs = [
    { key: "Home", icon: "🏠", route: Routes.Dashboard },
    { key: "Land", icon: "🗺️", route: Routes.Satellite },
    { key: "Crop", icon: "🌱", route: Routes.DiseaseDetection },
    { key: "Water", icon: "💧", route: Routes.Irrigation },
    { key: "Livestock", icon: "🎯", route: Routes.Livestock },
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

export function FieldDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = route.params as { fieldId?: string } | undefined;
  const fieldId = params?.fieldId ?? "B2";
  const field = MOCK_FIELDS[fieldId] ?? MOCK_FIELDS.B2;
  const { colors } = useTheme();
  const imageHeight = width * 0.45;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.headerBorder }]}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>Agrio</Text>
        </View>
        <Text style={styles.headerRight}>Land</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Field image */}
        <View style={[styles.fieldImage, { height: imageHeight, backgroundColor: field.imageTint }]}>
          <View style={styles.fieldImageTags}>
            <View style={styles.tagGreen}>
              <Text style={styles.tagText}>{field.name}</Text>
            </View>
            <View style={[styles.tagStatus, { backgroundColor: statusColor(field.status) }]}>
              <Text style={styles.tagStatusText}>{field.status}</Text>
            </View>
          </View>
          <View style={[styles.fieldImageTags, styles.fieldImageTagsBottom]}>
            <View style={styles.tagGreen}>
              <Text style={styles.tagText}>{field.crop}</Text>
            </View>
          </View>
        </View>

        {/* Metrics card */}
        <View style={styles.metricsCard}>
          <View style={styles.metricsGrid}>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>NDVI Index</Text>
              <View style={styles.metricValueRow}>
                <View style={styles.dotGreen} />
                <Text style={styles.metricValue}>{field.ndvi.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Soil Fertility</Text>
              <View style={styles.metricValueRow}>
                <View style={styles.dotBrown} />
                <Text style={styles.metricValue}>{field.soilFertility}</Text>
              </View>
            </View>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Area</Text>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricIcon}>📐</Text>
                <Text style={styles.metricValue}>{field.areaHa} ha</Text>
              </View>
            </View>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Health Score</Text>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricIcon}>🌱</Text>
                <Text style={styles.metricValue}>{field.healthScore}%</Text>
              </View>
            </View>
          </View>
          <View style={styles.calendarSection}>
            <Text style={styles.calendarIcon}>📅</Text>
            <Text style={styles.calendarTitle}>AI Crop Calendar</Text>
          </View>
          <Text style={styles.calendarLine}>Planted: {field.planted}</Text>
          <Text style={styles.calendarLine}>Est. Harvest: {field.estHarvest}</Text>
        </View>

        {/* Variable Rate Application */}
        <View style={styles.vraSection}>
          <Text style={styles.vraTitle}>Variable Rate Application</Text>
          <View style={styles.vraCard}>
            <Text style={styles.vraDesc}>
              AI-powered fertilizer mapping based on soil analysis and NDVI data.
            </Text>
            <View style={styles.vraBlocks}>
              <View style={styles.vraBlockWrap}>
                <View style={[styles.vraBlock, { backgroundColor: "#2E7D32" }]} />
                <Text style={styles.vraBlockLabel}>High</Text>
              </View>
              <View style={styles.vraBlockWrap}>
                <View style={[styles.vraBlock, { backgroundColor: "#66BB6A" }]} />
                <Text style={styles.vraBlockLabel}>Medium</Text>
              </View>
              <View style={styles.vraBlockWrap}>
                <View style={[styles.vraBlock, { backgroundColor: "#FFEB3B" }]} />
                <Text style={styles.vraBlockLabel}>Low</Text>
              </View>
              <View style={styles.vraBlockWrap}>
                <View style={[styles.vraBlock, { backgroundColor: "#E53935" }]} />
                <Text style={styles.vraBlockLabel}>Critical</Text>
              </View>
            </View>
            <Text style={styles.vraNext}>Next application scheduled: Feb 15, 2026</Text>
          </View>
        </View>
      </ScrollView>

      <TabBar active="Land" />
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
  backBtn: { fontSize: 24, color: "#2C2C2C" },
  headerCenter: { flexDirection: "row", alignItems: "center" },
  logoIcon: { fontSize: 24, marginRight: 6 },
  logoText: { fontSize: 20, fontWeight: "700", color: GREEN },
  headerRight: { fontSize: 14, color: "#666", fontWeight: "500" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  fieldImage: { width: "100%", position: "relative" },
  fieldImageTags: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fieldImageTagsBottom: { top: undefined, bottom: 12 },
  tagGreen: {
    backgroundColor: "rgba(76, 175, 80, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagText: { color: "#FFF", fontWeight: "600", fontSize: 13 },
  tagStatus: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  tagStatusText: { color: "#FFF", fontWeight: "600", fontSize: 12 },
  metricsCard: {
    backgroundColor: "#FFF",
    marginHorizontal: 24,
    marginTop: -16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -8 },
  metricBlock: { width: "50%", paddingHorizontal: 8, marginBottom: 16 },
  metricLabel: { fontSize: 12, color: "#666", marginBottom: 4 },
  metricValueRow: { flexDirection: "row", alignItems: "center" },
  dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN, marginRight: 6 },
  dotBrown: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#8D6E63", marginRight: 6 },
  metricValue: { fontSize: 15, fontWeight: "700", color: "#2C2C2C" },
  metricIcon: { fontSize: 14, marginRight: 6 },
  calendarSection: { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 6 },
  calendarIcon: { fontSize: 16, marginRight: 8 },
  calendarTitle: { fontSize: 14, fontWeight: "600", color: "#2C2C2C" },
  calendarLine: { fontSize: 13, color: "#555", marginLeft: 24 },
  vraSection: { marginTop: 24, paddingHorizontal: 24 },
  vraTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C", marginBottom: 12 },
  vraCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  vraDesc: { fontSize: 14, color: "#555", lineHeight: 22, marginBottom: 16 },
  vraBlocks: { flexDirection: "row", marginBottom: 16 },
  vraBlockWrap: { flex: 1, alignItems: "center", marginHorizontal: 4 },
  vraBlock: {
    width: "100%",
    height: 32,
    borderRadius: 8,
  },
  vraBlockLabel: { fontSize: 11, fontWeight: "600", color: "#555", marginTop: 6 },
  vraNext: { fontSize: 13, color: "#555" },
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
