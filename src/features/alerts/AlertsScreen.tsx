import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Routes } from "../../core/navigation/routes";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useTheme } from "../../core/theme/useTheme";

const OFFSET_WHITE = "#FAFAF8";
const GREEN = "#4CAF50";
const GREEN_LIGHT = "#E8F5E9";

const ALERTS = [
  {
    id: "1",
    type: "warning",
    icon: "⚠️",
    borderColor: "#FF9800",
    title: "Disease Detected",
    actionRequired: true,
    desc: "Bacterial Leaf Spot identified in corn field. Immediate action recommended to prevent spread.",
    location: "Field B2",
    time: "15 minutes ago",
  },
  {
    id: "2",
    type: "critical",
    icon: "⚡",
    borderColor: "#E53935",
    title: "Sensor Offline",
    actionRequired: true,
    desc: "Soil moisture sensor #A1-04 has stopped reporting data. Check sensor battery and connection.",
    location: "Zone A1",
    time: "2 hours ago",
  },
  {
    id: "3",
    type: "info",
    icon: "🎯",
    borderColor: "#2196F3",
    title: "Livestock Health Check",
    actionRequired: true,
    desc: "Elevated temperature detected in Cattle #C12. Veterinary consultation advised for precaution.",
    location: "Cattle #C12",
    time: "4 hours ago",
  },
  {
    id: "4",
    type: "warning",
    icon: "⚠️",
    borderColor: "#FFB74D",
    title: "Irrigation Schedule",
    actionRequired: false,
    desc: "Weather forecast shows rain in 48 hours. Consider adjusting irrigation schedule to save water.",
    location: "All Fields",
    time: "6 hours ago",
  },
];

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

export function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

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
        <Text style={styles.headerRight}>Alerts</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>All Alerts</Text>
        <Text style={styles.pageSubtitle}>4 active notifications.</Text>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryWarning]}>
            <Text style={styles.summaryValue}>2</Text>
            <Text style={styles.summaryLabel}>Warnings</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCritical]}>
            <Text style={styles.summaryValue}>1</Text>
            <Text style={styles.summaryLabel}>Critical</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryInfo]}>
            <Text style={styles.summaryValue}>1</Text>
            <Text style={styles.summaryLabel}>Info</Text>
          </View>
        </View>

        {/* Alert list */}
        {ALERTS.map((a) => (
          <View key={a.id} style={[styles.alertCard, { borderColor: a.borderColor }]}>
            <View style={styles.alertHeader}>
              <Text style={styles.alertIcon}>{a.icon}</Text>
              <Text style={styles.alertTitle}>{a.title}</Text>
              {a.actionRequired && (
                <View style={styles.actionPill}>
                  <Text style={styles.actionPillText}>Action Required</Text>
                </View>
              )}
            </View>
            <Text style={styles.alertDesc}>{a.desc}</Text>
            <View style={styles.alertMeta}>
              <Text style={styles.alertMetaText}>📍 {a.location}</Text>
              <Text style={styles.alertMetaText}>🕐 {a.time}</Text>
            </View>
            {a.actionRequired && (
              <View style={styles.alertActions}>
                <Pressable style={({ pressed }) => [styles.actionBtnPrimary, pressed && styles.pressed]}>
                  <Text style={styles.actionBtnPrimaryText}>Take Action</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.actionBtnSecondary, pressed && styles.pressed]}>
                  <Text style={styles.actionBtnSecondaryText}>✓ Mark Resolved</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <TabBar active="Alerts" />
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
  pageTitle: { fontSize: 22, fontWeight: "800", color: "#2C2C2C", marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: "#666", marginBottom: 20 },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
  },
  summaryWarning: { borderColor: "#FFB74D" },
  summaryCritical: { borderColor: "#E53935" },
  summaryInfo: { borderColor: "#64B5F6" },
  summaryValue: { fontSize: 28, fontWeight: "800", color: "#2C2C2C" },
  summaryLabel: { fontSize: 12, color: "#666", marginTop: 4 },
  alertCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  alertHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  alertIcon: { fontSize: 22, marginRight: 10 },
  alertTitle: { fontSize: 16, fontWeight: "700", color: "#2C2C2C", flex: 1 },
  actionPill: { backgroundColor: "#FF9800", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  actionPillText: { fontSize: 11, fontWeight: "600", color: "#FFF" },
  alertDesc: { fontSize: 14, color: "#555", lineHeight: 22, marginBottom: 12 },
  alertMeta: { flexDirection: "row", gap: 16, marginBottom: 12 },
  alertMetaText: { fontSize: 13, color: "#666" },
  alertActions: { flexDirection: "row", gap: 12 },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: GREEN,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  actionBtnPrimaryText: { fontSize: 14, fontWeight: "600", color: "#FFF" },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEE",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  actionBtnSecondaryText: { fontSize: 14, fontWeight: "600", color: "#2C2C2C" },
  pressed: { opacity: 0.9 },
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
