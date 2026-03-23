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

type FieldStatus = "Good" | "Warning" | "Poor";

type FieldItem = {
  id: string;
  name: string;
  crop: string;
  status: FieldStatus;
  ndvi: number;
  soilFertility: "High" | "Medium" | "Low";
  areaHa: number;
  healthScore: number;
  planted: string;
  estHarvest: string;
  imageTint: string; // placeholder color
};

const MOCK_FIELDS: FieldItem[] = [
  {
    id: "A1",
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
  {
    id: "A2",
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
  {
    id: "B2",
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
];

function statusColor(s: FieldStatus): string {
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

export function LandScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const imageHeight = width * 0.5;

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
        <Text style={styles.headerRight}>Land Planning</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryIcon}>📐</Text>
              <View>
                <Text style={styles.summaryLabel}>Total Area</Text>
                <Text style={styles.summaryValue}>48.0 ha</Text>
              </View>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryIcon}>🌱</Text>
              <View>
                <Text style={styles.summaryLabel}>Active Fields</Text>
                <Text style={styles.summaryValue}>4</Text>
              </View>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryIcon}>📈</Text>
              <View>
                <Text style={styles.summaryLabel}>Avg Health</Text>
                <Text style={styles.summaryValue}>82.5%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Field Segmentation */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Field Segmentation</Text>
            <TouchableOpacity onPress={() => {}}>
              <Text style={styles.pinIcon}>📍</Text>
            </TouchableOpacity>
          </View>

          {MOCK_FIELDS.map((field) => (
            <Pressable
              key={field.id}
              style={styles.fieldCard}
              onPress={() => nav.navigate(Routes.FieldDetail, { fieldId: field.id })}
            >
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
              <View style={styles.fieldMetrics}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>NDVI Index</Text>
                  <View style={styles.metricValueRow}>
                    <View style={styles.dotGreen} />
                    <Text style={styles.metricValue}>{field.ndvi.toFixed(2)}</Text>
                  </View>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Soil Fertility</Text>
                  <View style={styles.metricValueRow}>
                    <View style={styles.dotBrown} />
                    <Text style={styles.metricValue}>{field.soilFertility}</Text>
                  </View>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Area</Text>
                  <View style={styles.metricValueRow}>
                    <Text style={styles.metricIcon}>📐</Text>
                    <Text style={styles.metricValue}>{field.areaHa} ha</Text>
                  </View>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Health Score</Text>
                  <View style={styles.metricValueRow}>
                    <Text style={styles.metricIcon}>🌱</Text>
                    <Text style={styles.metricValue}>{field.healthScore}%</Text>
                  </View>
                </View>
                <View style={styles.calendarSection}>
                  <Text style={styles.calendarIcon}>📅</Text>
                  <Text style={styles.calendarTitle}>AI Crop Calendar</Text>
                </View>
                <Text style={styles.calendarLine}>Planted: {field.planted}</Text>
                <Text style={styles.calendarLine}>Est. Harvest: {field.estHarvest}</Text>
              </View>
            </Pressable>
          ))}
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
  hamburger: { fontSize: 22, color: "#2C2C2C" },
  headerCenter: { flexDirection: "row", alignItems: "center" },
  logoIcon: { fontSize: 24, marginRight: 6 },
  logoText: { fontSize: 20, fontWeight: "700", color: GREEN },
  headerRight: { fontSize: 14, color: "#666", fontWeight: "500" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20 },
  summaryCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { flexDirection: "row", alignItems: "center" },
  summaryIcon: { fontSize: 22, marginRight: 10 },
  summaryLabel: { fontSize: 12, color: "#666" },
  summaryValue: { fontSize: 16, fontWeight: "700", color: "#2C2C2C" },
  section: { marginBottom: 24 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C" },
  pinIcon: { fontSize: 18 },
  fieldCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  fieldImage: {
    width: "100%",
    position: "relative",
  },
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
  tagStatus: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tagStatusText: { color: "#FFF", fontWeight: "600", fontSize: 12 },
  fieldMetrics: { padding: 16 },
  metricRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  metricLabel: { fontSize: 13, color: "#666" },
  metricValueRow: { flexDirection: "row", alignItems: "center" },
  dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN, marginRight: 6 },
  dotBrown: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#8D6E63", marginRight: 6 },
  metricValue: { fontSize: 14, fontWeight: "600", color: "#2C2C2C" },
  metricIcon: { fontSize: 14, marginRight: 6 },
  calendarSection: { flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 6 },
  calendarIcon: { fontSize: 16, marginRight: 8 },
  calendarTitle: { fontSize: 14, fontWeight: "600", color: "#2C2C2C" },
  calendarLine: { fontSize: 13, color: "#555", marginLeft: 24 },
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
