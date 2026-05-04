import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Switch,
  useWindowDimensions,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Routes } from "../../core/navigation/routes";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useTheme } from "../../core/theme/useTheme";
import { irrigationApi, DashboardData } from "./services/irrigationApi";

const OFFSET_WHITE = "#FAFAF8";
const GREEN = "#4CAF50";
const GREEN_LIGHT = "#E8F5E9";

const INITIAL_ACTIVITY_LOG = [
  { id: "1", color: GREEN, msg: "Irrigation activated", field: "Field A1", vol: "450L", time: "06:00 AM" },
  { id: "2", color: "#FF9800", msg: "Skipped due to rain forecast", field: "Field B2", vol: "0L", time: "02:30 PM" },
];

function TabBar({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabs = [
    { key: "Home", icon: "🏠", route: Routes.Dashboard },
    { key: "Land", icon: "🗺️", route: Routes.Satellite },
    { key: "Crop", icon: "🌱", route: Routes.DiseaseDetection },
    { key: "Water", icon: "💧", route: Routes.Irrigation },
    { key: "Livestock", icon: "🎯", route: Routes.Livestock },
    { key: "Prices", icon: "📈", route: Routes.MarketPrices },
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
  const [activityLog, setActivityLog] = useState(INITIAL_ACTIVITY_LOG);
  const [isLoading, setIsLoading] = useState(false);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isDashboardLoading, setDashboardLoading] = useState(true);

  // Schedule Modal state
  const [isScheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleDuration, setScheduleDuration] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
    loadAutonomousState();
  }, []);

  const loadAutonomousState = async () => {
    try {
      const state = await irrigationApi.getAutonomousState();
      setAutonomousOn(state.autonomous);
    } catch (e) {
      console.error("Failed to fetch autonomous state.");
    }
  };

  const toggleAutonomous = async (val: boolean) => {
    setAutonomousOn(val);
    try {
      await irrigationApi.setAutonomousState(val);
    } catch (e) {
      setAutonomousOn(!val);
      Alert.alert("Error", "Failed to update autonomous configuration. Please check your connection.");
    }
  };

  const loadDashboard = async () => {
    try {
      const data = await irrigationApi.getDashboardData();
      setDashboardData(data);
      const schedData = await irrigationApi.getSchedules();
      setSchedules(schedData.schedules || []);
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setDashboardLoading(false);
    }
  };

  const handleCheckIrrigation = async () => {
    setIsLoading(true);
    try {
      const data = await irrigationApi.checkIrrigation("Wheat", 36.8, 10.18);
      const decisionStr = data.decision || "";
      const isIrrigate = decisionStr.includes("Irrigate");

      const newLog = {
        id: Date.now().toString(),
        color: isIrrigate ? GREEN : "#FF9800",
        msg: decisionStr || "Agent Decision received",
        field: "Field A1",
        vol: isIrrigate ? "Auto" : "0L",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setActivityLog(prev => [newLog, ...prev]);

      // Refresh dashboard to reflect new possible usage
      loadDashboard();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to reach backend API.");
    } finally {
      setIsLoading(false);
    }
  };

  const parseSmartDate = (d: string) => {
    const text = d.trim().toLowerCase();
    const now = new Date();
    if (text === "today") return now;
    if (text === "tomorrow") {
      now.setDate(now.getDate() + 1);
      return now;
    }
    if (/^\d{1,2}$/.test(text)) {
      const day = parseInt(text, 10);
      let target = new Date(now.getFullYear(), now.getMonth(), day);
      // if passing the 12th when it's the 15th, assume next month
      if (target.getDate() < now.getDate()) target.setMonth(target.getMonth() + 1);
      return target;
    }
    return new Date(text);
  };

  const parseSmartTime = (t: string) => {
    const text = t.trim().toLowerCase();
    if (/^\d{1,2}$/.test(text)) {
       let hr = parseInt(text, 10);
       let ap = "AM";
       if (hr >= 12) {
         if (hr > 12) hr -= 12;
         ap = "PM";
       } else if (hr === 0) { hr = 12; }
       return `${hr.toString().padStart(2, '0')}:00 ${ap}`;
    }
    return text;
  };

  const submitSchedule = async () => {
    if (!scheduleDate.trim() || !scheduleTime.trim() || !scheduleDuration.trim()) {
      Alert.alert("Validation Error", "Please fill in all fields.");
      return;
    }
    const durationNum = parseInt(scheduleDuration, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      Alert.alert("Validation Error", "Duration must be a positive number.");
      return;
    }

    const smartT = parseSmartTime(scheduleTime);
    const smartD = parseSmartDate(scheduleDate);
    
    if (isNaN(smartD.getTime())) {
      Alert.alert("Validation Error", "Invalid Date format. Try 'tomorrow' or '24'.");
      return;
    }

    // Convert smartly parsed time like "10:00 AM" back into 24-hr layout for strict JS Date engine
    let tMatch = smartT.match(/(\d+):(\d+)\s*(AM|PM)/i);
    let hh = 8;
    let mmStr = "00";
    if (tMatch) {
       hh = parseInt(tMatch[1], 10);
       mmStr = tMatch[2];
       const ampm = tMatch[3].toUpperCase();
       if (ampm === "PM" && hh < 12) hh += 12;
       if (ampm === "AM" && hh === 12) hh = 0;
    }

    const isoTime = `${hh.toString().padStart(2, '0')}:${mmStr}:00`;

    // Attempt to combine date and time safely.
    const targetDateObj = new Date(`${smartD.toISOString().split('T')[0]}T${isoTime}`);
    if (isNaN(targetDateObj.getTime())) {
      Alert.alert("Validation Error", `Invalid Time format. Try '8' or '08:00 AM'. (Parsed as: ${smartT})`);
      return;
    }
    
    if (targetDateObj.getTime() < Date.now() - 60000) { // 1 min grace period
      Alert.alert("Validation Error", "You cannot schedule irrigation in the past!");
      return;
    }

    setIsScheduling(true);
    try {
      await irrigationApi.createSchedule({
        field_id: "Field A1",
        target_date: smartD.toISOString().split('T')[0],
        start_time: smartT,
        duration_minutes: durationNum,
        water_volume: durationNum * 5 // Mock volume mapping
      });
      setScheduleModalVisible(false);
      setScheduleDate("");
      setScheduleTime("");
      setScheduleDuration("");
      Alert.alert("Success", "Irrigation scheduled successfully!");
      loadDashboard();
    } catch (e) {
      Alert.alert("Error", "Failed to create schedule.");
    } finally {
      setIsScheduling(false);
    }
  };

  const renderWeatherIcon = (rain: number) => {
    if (rain > 5) return "🌧️";
    if (rain > 0) return "🌦️";
    return "☀️";
  };

  const getDayName = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "Day" : d.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const currentMoisture = dashboardData?.moisture?.moisture_percent || 45;
  const moistureStatus = dashboardData?.moisture?.status || "Normal";
  
  const moistureHistory = dashboardData?.moisture?.history || [];
  const maxVal = Math.max(...moistureHistory.map((h: any) => h.value), dashboardData?.moisture?.moisture_percent || 45);
  const minVal = Math.min(...moistureHistory.map((h: any) => h.value), dashboardData?.moisture?.moisture_percent || 45);
  const range = maxVal - minVal || 1;
  const graphWidth = width - 24 * 2 - 32;
  const graphHeight = 120;

  if (isDashboardLoading) {
    return (
      <View style={[styles.container, styles.centerAlign]}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

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
              onValueChange={toggleAutonomous}
              trackColor={{ false: "#CCC", true: GREEN_LIGHT }}
              thumbColor={autonomousOn ? GREEN : "#FFF"}
            />
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>System Status</Text>
              <View style={styles.statusValueRow}>
                <Text style={styles.statusIcon}>{autonomousOn ? "✓" : "⏸️"}</Text>
                <Text style={styles.statusValue}>{autonomousOn ? "Active" : "Deactivated"}</Text>
              </View>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>Water Saved</Text>
              <View style={styles.statusValueRow}>
                <Text style={styles.statusIcon}>〰️</Text>
                <Text style={[styles.statusValue, { color: GREEN }]}>
                 {dashboardData?.usage_history?.water_saved_pct?.toFixed(1) || "0.0"}% ↓
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 5-Day Forecast */}
        <Text style={styles.sectionTitle}>5-Day Forecast</Text>
        <View style={styles.forecastRow}>
          {dashboardData?.weather ? dashboardData.weather.slice(0, 5).map((f: any, idx) => (
            <View key={idx} style={styles.forecastCard}>
              <Text style={styles.forecastDay}>{getDayName(f.date)}</Text>
              <Text style={styles.forecastIcon}>{renderWeatherIcon(f.precipitation_mm)}</Text>
              <Text style={styles.forecastTemp}>{Math.round(f.t_max)}°C</Text>
              {f.precipitation_mm > 0 && <Text style={styles.forecastRain}>{f.precipitation_mm}mm</Text>}
            </View>
          )) : (
            <Text style={{color: '#666'}}>Weather data unavailable</Text>
          )}
        </View>

        {/* Real-Time Soil Moisture */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Real-Time Soil Moisture</Text>
            <Text style={styles.fieldLabel}>Field A1</Text>
          </View>
          <View style={styles.moistureCard}>
            <View style={styles.moistureStats}>
              <View><Text style={styles.moistureLabel}>Current</Text><Text style={styles.moistureValue}>{currentMoisture.toFixed(1)}%</Text></View>
              <View><Text style={styles.moistureLabel}>Optimal</Text><Text style={[styles.moistureValue, { color: GREEN }]}>45-55%</Text></View>
              <View><Text style={styles.moistureLabel}>Status</Text><View style={styles.statusPill}><Text style={styles.statusPillText}>{moistureStatus}</Text></View></View>
            </View>
            <Text style={styles.sensorConnectionText}>
              Sensor: {dashboardData?.moisture?.live ? "Live MQTT" : "Fallback value"}
              {dashboardData?.moisture?.mqtt_connected ? " · broker connected" : " · broker not connected"}
              {dashboardData?.moisture?.topic ? ` · ${dashboardData.moisture.topic}` : ""}
            </Text>
            <View style={styles.graphWrap}>
              <View style={[styles.graphArea, { width: graphWidth, height: graphHeight }]}>
                {moistureHistory.map((h: any, i: number) => (
                  <View
                    key={i}
                    style={[
                      styles.graphBar,
                      {
                        width: Math.max(2, graphWidth / Math.max(moistureHistory.length, 1) - 3),
                        height: Math.max(6, ((h.value - minVal) / range) * (graphHeight - 20) + 10),
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={[styles.graphXLabels, { width: graphWidth }]}>
                {moistureHistory.filter((_: any, i: number) => i % Math.ceil(moistureHistory.length / 5) === 0).map((h: any, i: number) => (
                   <Text key={i} style={styles.graphXLabel}>{h.time.substring(0, 5)}</Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Weekly Water Usage -> Today's Usage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Water Usage</Text>
          <View style={styles.usageCard}>
            <Text style={styles.usageValue}>{dashboardData?.usage_today?.toFixed(2) || "0.00"} mm</Text>
          </View>
        </View>

        {/* Today's Activity Log */}
        <Text style={styles.sectionTitle}>Today's Activity Log</Text>
        {activityLog.map((entry) => (
          <View key={entry.id} style={styles.logCard}>
            <View style={[styles.logDot, { backgroundColor: entry.color }]} />
            <View style={styles.logBody}>
              <Text style={styles.logMsg}>{entry.msg}</Text>
              <Text style={styles.logField}>{entry.field} · {entry.vol}</Text>
            </View>
            <Text style={styles.logTime}>{entry.time}</Text>
          </View>
        ))}

        {/* Scheduled Irrigations */}
        {schedules.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>History & Schedules</Text>
            {schedules.map((s, idx) => (
              <View key={idx} style={styles.logCard}>
                <View style={[styles.logDot, { backgroundColor: '#2196F3' }]} />
                <View style={styles.logBody}>
                  <Text style={styles.logMsg}>{s.target_date} at {s.start_time}</Text>
                  <Text style={styles.logField}>{s.field_id} · {s.duration_minutes} mins · {s.status}</Text>
                </View>
                <Text style={styles.logTime}>⏳</Text>
              </View>
            ))}
          </View>
        )}

        {/* Manual Override & Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Manual Override</Text>
            <Text style={styles.calendarIcon}>📅</Text>
          </View>
          <Text style={styles.overrideDesc}>Take control when needed. System will return to auto mode after 24 hours.</Text>
          <View style={styles.overrideButtons}>
            <Pressable 
              onPress={handleCheckIrrigation}
              disabled={isLoading}
              style={({ pressed }) => [styles.overrideBtn, styles.overrideBtnPrimary, (pressed || isLoading) && styles.pressed]}
            >
              <Text style={styles.overrideBtnIcon}>{isLoading ? "⏳" : "🔍"}</Text>
              <Text style={styles.overrideBtnText}>{isLoading ? "Evaluating..." : "Evaluate Field Now"}</Text>
            </Pressable>
            <Pressable 
              onPress={() => setScheduleModalVisible(true)}
              style={({ pressed }) => [styles.overrideBtn, pressed && styles.pressed]}
            >
              <Text style={styles.overrideBtnText}>Schedule</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <TabBar active="Water" />

      {/* Scheduler Modal */}
      <Modal visible={isScheduleModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Schedule Irrigation</Text>
            
            <Text style={styles.inputLabel}>Target Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.textInput}
              value={scheduleDate}
              onChangeText={setScheduleDate}
              placeholder="e.g. 2026-03-28"
            />
            
            <Text style={styles.inputLabel}>Start Time (e.g., 08:00 AM)</Text>
            <TextInput
              style={styles.textInput}
              value={scheduleTime}
              onChangeText={setScheduleTime}
              placeholder="08:00 AM"
            />
            
            <Text style={styles.inputLabel}>Duration (minutes)</Text>
            <TextInput
              style={styles.textInput}
              value={scheduleDuration}
              onChangeText={setScheduleDuration}
              placeholder="30"
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnCancel} onPress={() => setScheduleModalVisible(false)}>
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalBtnSubmit} onPress={submitSchedule} disabled={isScheduling}>
                <Text style={styles.modalBtnTextSubmit}>{isScheduling ? "Saving..." : "Save Schedule"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  centerAlign: { justifyContent: "center", alignItems: "center" },
  container: { flex: 1, backgroundColor: OFFSET_WHITE },
  calendarIcon: { fontSize: 20 },
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
  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: "#EEE" },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C" },
  cardSubtitle: { fontSize: 13, color: "#666", marginTop: 4 },
  statusRow: { flexDirection: "row", gap: 12 },
  statusCard: { flex: 1, backgroundColor: "#F5F5F5", borderRadius: 12, padding: 14 },
  statusLabel: { fontSize: 12, color: "#666", marginBottom: 6 },
  statusValueRow: { flexDirection: "row", alignItems: "center" },
  statusIcon: { fontSize: 16, marginRight: 6 },
  statusValue: { fontSize: 16, fontWeight: "700", color: "#2C2C2C" },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C", marginBottom: 12 },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: "#666" },
  section: { marginBottom: 24 },
  forecastRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  forecastCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#EEE" },
  forecastDay: { fontSize: 12, color: "#666", marginBottom: 4 },
  forecastIcon: { fontSize: 24, marginBottom: 4 },
  forecastTemp: { fontSize: 14, fontWeight: "700", color: "#2C2C2C" },
  forecastRain: { fontSize: 11, color: "#2196F3", marginTop: 2 },
  moistureCard: { backgroundColor: "#FFF", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#EEE" },
  moistureStats: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  moistureLabel: { fontSize: 12, color: "#666" },
  moistureValue: { fontSize: 16, fontWeight: "700", color: "#2C2C2C" },
  sensorConnectionText: { fontSize: 12, color: "#666", marginBottom: 12 },
  statusPill: { backgroundColor: GREEN, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" },
  statusPillText: { fontSize: 12, fontWeight: "600", color: "#FFF" },
  graphWrap: { marginTop: 8 },
  graphArea: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", backgroundColor: "#F5F5F5", borderRadius: 8, paddingHorizontal: 4, paddingBottom: 4 },
  graphBar: { backgroundColor: "#2196F3", borderRadius: 2 },
  graphXLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  graphXLabel: { fontSize: 10, color: "#666" },
  usageCard: { backgroundColor: "#FFF", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#EEE" },
  usageValue: { fontSize: 24, fontWeight: "700", color: "#2C2C2C" },
  logCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#EEE" },
  logDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  logBody: { flex: 1 },
  logMsg: { fontSize: 14, fontWeight: "600", color: "#2C2C2C" },
  logField: { fontSize: 12, color: "#666", marginTop: 2 },
  logTime: { fontSize: 12, color: "#666" },
  overrideDesc: { fontSize: 14, color: "#555", marginBottom: 16, lineHeight: 22 },
  overrideButtons: { flexDirection: "row", gap: 12 },
  overrideBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#EEE" },
  overrideBtnPrimary: { backgroundColor: GREEN_LIGHT, borderColor: "#A5D6A7" },
  overrideBtnIcon: { fontSize: 18, marginRight: 8 },
  overrideBtnText: { fontSize: 14, fontWeight: "600", color: "#2C2C2C" },
  pressed: { opacity: 0.9 },
  systemCard: { marginBottom: 24 },
  systemImage: { borderRadius: 16, overflow: "hidden", position: "relative" },
  systemBadge: { position: "absolute", bottom: 12, left: 12, backgroundColor: GREEN, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  systemBadgeText: { fontSize: 13, fontWeight: "600", color: "#FFF" },
  tabBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingTop: 12, paddingHorizontal: 8, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#EEE" },
  tabItem: { alignItems: "center", flex: 1 },
  tabIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  tabIconWrapActive: { backgroundColor: GREEN_LIGHT },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 10, color: "#666" },
  tabLabelActive: { color: GREEN, fontWeight: "600" },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalContent: { backgroundColor: "#FFF", borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 20, color: "#2C2C2C" },
  inputLabel: { fontSize: 14, fontWeight: "500", color: "#666", marginBottom: 8 },
  textInput: { borderWidth: 1, borderColor: "#DDD", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalBtnCancel: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  modalBtnTextCancel: { fontSize: 16, color: "#666", fontWeight: "600" },
  modalBtnSubmit: { backgroundColor: GREEN, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  modalBtnTextSubmit: { fontSize: 16, color: "#FFF", fontWeight: "600" }
});
