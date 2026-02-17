import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Switch,
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

const FORECAST = [
  { day: "Mon", icon: "☀️", temp: "24°C", rain: null },
  { day: "Tue", icon: "🌧️", temp: "22°C", rain: "65%" },
  { day: "Wed", icon: "🌧️", temp: "20°C", rain: "80%" },
  { day: "Thu", icon: "☀️", temp: "25°C", rain: "10%" },
  { day: "Fri", icon: "💨", temp: "23°C", rain: "20%" },
];

const ACTIVITY_LOG = [
  { id: "1", color: GREEN, msg: "Irrigation activated", field: "Field A1", vol: "450L", time: "06:00 AM" },
  { id: "2", color: "#FF9800", msg: "Skipped due to rain forecast", field: "Field B2", vol: "0L", time: "02:30 PM" },
  { id: "3", color: GREEN, msg: "Irrigation activated", field: "Field B1", vol: "380L", time: "05:45 PM" },
  { id: "4", color: "#2196F3", msg: "System check completed", field: "All zones", vol: "—", time: "11:00 PM" },
];

// Mock data points for soil moisture graph (hour -> %)
const MOISTURE_DATA = [48, 46, 44, 38, 32, 30, 35, 42, 50, 54, 55, 52, 48];

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

export function IrrigationScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [autonomousOn, setAutonomousOn] = useState(false);

  const graphWidth = width - 24 * 2 - 32;
  const graphHeight = 120;
  const maxVal = Math.max(...MOISTURE_DATA);
  const minVal = Math.min(...MOISTURE_DATA);
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
        <Text style={styles.headerRight}>Irrigation</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Autonomous Control */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View>
              <Text style={styles.cardTitle}>Autonomous Control</Text>
              <Text style={styles.cardSubtitle}>AI-powered irrigation system</Text>
            </View>
            <Switch
              value={autonomousOn}
              onValueChange={setAutonomousOn}
              trackColor={{ false: "#CCC", true: GREEN_LIGHT }}
              thumbColor={autonomousOn ? GREEN : "#FFF"}
            />
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>System Status</Text>
              <View style={styles.statusValueRow}>
                <Text style={styles.statusIcon}>✓</Text>
                <Text style={styles.statusValue}>Active</Text>
              </View>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>Water Saved</Text>
              <View style={styles.statusValueRow}>
                <Text style={styles.statusIcon}>〰️</Text>
                <Text style={[styles.statusValue, { color: GREEN }]}>18% ↓</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 5-Day Forecast */}
        <Text style={styles.sectionTitle}>5-Day Forecast</Text>
        <View style={styles.forecastRow}>
          {FORECAST.map((f) => (
            <View key={f.day} style={styles.forecastCard}>
              <Text style={styles.forecastDay}>{f.day}</Text>
              <Text style={styles.forecastIcon}>{f.icon}</Text>
              <Text style={styles.forecastTemp}>{f.temp}</Text>
              {f.rain != null && <Text style={styles.forecastRain}>{f.rain}</Text>}
            </View>
          ))}
        </View>

        {/* Real-Time Soil Moisture */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Real-Time Soil Moisture</Text>
            <Text style={styles.fieldLabel}>Field A1</Text>
          </View>
          <View style={styles.moistureCard}>
            <View style={styles.moistureStats}>
              <View><Text style={styles.moistureLabel}>Current</Text><Text style={styles.moistureValue}>48%</Text></View>
              <View><Text style={styles.moistureLabel}>Optimal</Text><Text style={[styles.moistureValue, { color: GREEN }]}>45-55%</Text></View>
              <View><Text style={styles.moistureLabel}>Status</Text><View style={styles.statusPill}><Text style={styles.statusPillText}>Normal</Text></View></View>
            </View>
            <View style={styles.graphWrap}>
              <View style={[styles.graphArea, { width: graphWidth, height: graphHeight }]}>
                {MOISTURE_DATA.map((val, i) => (
                  <View
                    key={i}
                    style={[
                      styles.graphBar,
                      {
                        width: Math.max(2, graphWidth / MOISTURE_DATA.length - 3),
                        height: Math.max(6, ((val - minVal) / range) * (graphHeight - 20) + 10),
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={[styles.graphXLabels, { width: graphWidth }]}>
                <Text style={styles.graphXLabel}>00:00</Text>
                <Text style={styles.graphXLabel}>08:00</Text>
                <Text style={styles.graphXLabel}>12:00</Text>
                <Text style={styles.graphXLabel}>16:00</Text>
                <Text style={styles.graphXLabel}>24:00</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Weekly Water Usage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Water Usage</Text>
          <View style={styles.usageCard}>
            <Text style={styles.usageValue}>19,917 L</Text>
          </View>
        </View>

        {/* Today's Activity Log */}
        <Text style={styles.sectionTitle}>Today's Activity Log</Text>
        {ACTIVITY_LOG.map((entry) => (
          <View key={entry.id} style={styles.logCard}>
            <View style={[styles.logDot, { backgroundColor: entry.color }]} />
            <View style={styles.logBody}>
              <Text style={styles.logMsg}>{entry.msg}</Text>
              <Text style={styles.logField}>{entry.field} · {entry.vol}</Text>
            </View>
            <Text style={styles.logTime}>{entry.time}</Text>
          </View>
        ))}

        {/* Manual Override */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Manual Override</Text>
            <Text style={styles.calendarIcon}>📅</Text>
          </View>
          <Text style={styles.overrideDesc}>Take control when needed. System will return to auto mode after 24 hours.</Text>
          <View style={styles.overrideButtons}>
            <Pressable style={({ pressed }) => [styles.overrideBtn, styles.overrideBtnPrimary, pressed && styles.pressed]}>
              <Text style={styles.overrideBtnIcon}>💧</Text>
              <Text style={styles.overrideBtnText}>Start Now</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.overrideBtn, pressed && styles.pressed]}>
              <Text style={styles.overrideBtnText}>Schedule</Text>
            </Pressable>
          </View>
        </View>

        {/* Irrigation System */}
        <Text style={styles.sectionTitle}>Irrigation System</Text>
        <View style={styles.systemCard}>
          <View style={[styles.systemImage, { height: width * 0.4, backgroundColor: "#B3E5FC" }]}>
            <View style={styles.systemBadge}>
              <Text style={styles.systemBadgeText}>Precision Drip System Active</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <TabBar active="Water" />
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
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C" },
  cardSubtitle: { fontSize: 13, color: "#666", marginTop: 4 },
  statusRow: { flexDirection: "row", gap: 12 },
  statusCard: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 14,
  },
  statusLabel: { fontSize: 12, color: "#666", marginBottom: 6 },
  statusValueRow: { flexDirection: "row", alignItems: "center" },
  statusIcon: { fontSize: 16, marginRight: 6 },
  statusValue: { fontSize: 16, fontWeight: "700", color: "#2C2C2C" },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C", marginBottom: 12 },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: "#666" },
  section: { marginBottom: 24 },
  forecastRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  forecastCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  forecastDay: { fontSize: 12, color: "#666", marginBottom: 4 },
  forecastIcon: { fontSize: 24, marginBottom: 4 },
  forecastTemp: { fontSize: 14, fontWeight: "700", color: "#2C2C2C" },
  forecastRain: { fontSize: 11, color: "#2196F3", marginTop: 2 },
  moistureCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  moistureStats: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  moistureLabel: { fontSize: 12, color: "#666" },
  moistureValue: { fontSize: 16, fontWeight: "700", color: "#2C2C2C" },
  statusPill: { backgroundColor: GREEN, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" },
  statusPillText: { fontSize: 12, fontWeight: "600", color: "#FFF" },
  graphWrap: { marginTop: 8 },
  graphArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  graphBar: { backgroundColor: "#2196F3", borderRadius: 2 },
  graphXLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  graphXLabel: { fontSize: 10, color: "#666" },
  usageCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  usageValue: { fontSize: 24, fontWeight: "700", color: "#2C2C2C" },
  logCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  logDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  logBody: { flex: 1 },
  logMsg: { fontSize: 14, fontWeight: "600", color: "#2C2C2C" },
  logField: { fontSize: 12, color: "#666", marginTop: 2 },
  logTime: { fontSize: 12, color: "#666" },
  overrideDesc: { fontSize: 14, color: "#555", marginBottom: 16, lineHeight: 22 },
  overrideButtons: { flexDirection: "row", gap: 12 },
  overrideBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  overrideBtnPrimary: { backgroundColor: GREEN_LIGHT, borderColor: "#A5D6A7" },
  overrideBtnIcon: { fontSize: 18, marginRight: 8 },
  overrideBtnText: { fontSize: 14, fontWeight: "600", color: "#2C2C2C" },
  pressed: { opacity: 0.9 },
  systemCard: { marginBottom: 24 },
  systemImage: { borderRadius: 16, overflow: "hidden", position: "relative" },
  systemBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: GREEN,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  systemBadgeText: { fontSize: 13, fontWeight: "600", color: "#FFF" },
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
