import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Routes } from "../../core/navigation/routes";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useTheme } from "../../core/theme/useTheme";

const OFFSET_WHITE = "#FAFAF8";
const GREEN = "#4CAF50";
const GREEN_LIGHT = "#E8F5E9";

type Severity = "High" | "Medium" | "Low";

type DiagnosisEntry = {
  id: string;
  name: string;
  confidence: number;
  date: string;
  severity: Severity;
  thumbnailUri?: string;
};

const MOCK_HISTORY: DiagnosisEntry[] = [
  { id: "1", name: "Bacterial Leaf Spot", confidence: 94, date: "Feb 1, 2026", severity: "High", thumbnailUri: undefined },
  { id: "2", name: "Early Blight", confidence: 89, date: "Jan 28, 2026", severity: "Medium" },
  { id: "3", name: "Powdery Mildew", confidence: 91, date: "Jan 25, 2026", severity: "Low" },
];

function severityColor(s: Severity): string {
  if (s === "High") return "#E53935";
  if (s === "Medium") return "#FF9800";
  return "#2196F3";
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

export function DiseaseDetectionScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [history, setHistory] = useState<DiagnosisEntry[]>(MOCK_HISTORY);

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to capture images.");
      return false;
    }
    return true;
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Gallery access is required to upload images.");
      return false;
    }
    return true;
  };

  const handleCapture = async () => {
    const ok = await requestCameraPermission();
    if (!ok) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        // TODO: run diagnosis (on-device or API) and add to history
        Alert.alert("Image captured", "Diagnosis would run here. Add your model or API.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not open camera.");
    }
  };

  const handleUpload = async () => {
    const ok = await requestMediaLibraryPermission();
    if (!ok) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        // TODO: run diagnosis and add to history
        Alert.alert("Image selected", "Diagnosis would run here. Add your model or API.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not open gallery.");
    }
  };

  const buttonWidth = (width - 24 * 2 - 16) / 2;

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
        <Text style={styles.headerRight}>Crop Health</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Capture or Upload */}
        <Text style={styles.sectionTitle}>Capture or Upload</Text>
        <View style={styles.captureRow}>
          <Pressable style={({ pressed }) => [styles.captureCard, { width: buttonWidth }, pressed && styles.captureCardPressed]} onPress={handleCapture}>
            <Text style={styles.captureIcon}>📷</Text>
            <Text style={styles.captureTitle}>Capture Image</Text>
            <Text style={styles.captureSub}>Use camera</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.captureCard, styles.captureCardGreen, { width: buttonWidth }, pressed && styles.captureCardPressed]} onPress={handleUpload}>
            <Text style={styles.captureIcon}>📤</Text>
            <Text style={styles.captureTitle}>Upload Image</Text>
            <Text style={styles.captureSub}>From gallery</Text>
          </Pressable>
        </View>

        {/* Diagnosis History */}
        <Text style={styles.sectionTitle}>Diagnosis History</Text>
        {history.map((entry) => (
          <View key={entry.id} style={styles.historyCard}>
            <View style={styles.historyThumb}>
              {entry.thumbnailUri ? (
                <Image source={{ uri: entry.thumbnailUri }} style={styles.historyThumbImage} />
              ) : (
                <View style={styles.historyThumbPlaceholder}>
                  <Text style={styles.historyThumbIcon}>🌿</Text>
                </View>
              )}
            </View>
            <View style={styles.historyBody}>
              <Text style={styles.historyName}>{entry.name}</Text>
              <View style={styles.historyMeta}>
                <Text style={styles.historyMetaText}>✓ {entry.confidence}%</Text>
                <Text style={styles.historyMetaText}>🕐 {entry.date}</Text>
              </View>
            </View>
            <View style={[styles.severityTag, { backgroundColor: severityColor(entry.severity) }]}>
              <Text style={styles.severityText}>{entry.severity}</Text>
            </View>
          </View>
        ))}

        {/* Pro Tips */}
        <View style={styles.proTipsCard}>
          <View style={styles.proTipsTitleRow}>
            <Text style={styles.proTipsTitle}>Pro Tips for Best Results</Text>
            <Text style={styles.proTipsInfoIcon}>ℹ️</Text>
          </View>
          <Text style={styles.proTipsBullet}>• Take clear, well-lit photos</Text>
          <Text style={styles.proTipsBullet}>• Focus on affected leaf areas</Text>
          <Text style={styles.proTipsBullet}>• Include multiple angles if possible</Text>
          <Text style={styles.proTipsBullet}>• Clean the lens before capture</Text>
        </View>
      </ScrollView>

      <TabBar active="Crop" />
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
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C", marginBottom: 12 },
  captureRow: { flexDirection: "row", gap: 16, marginBottom: 28 },
  captureCard: {
    backgroundColor: "#FFF8E1",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFECB3",
  },
  captureCardGreen: {
    backgroundColor: GREEN_LIGHT,
    borderColor: "#A5D6A7",
  },
  captureCardPressed: { opacity: 0.9 },
  captureIcon: { fontSize: 40, marginBottom: 12 },
  captureTitle: { fontSize: 16, fontWeight: "700", color: "#2C2C2C", marginBottom: 4 },
  captureSub: { fontSize: 13, color: "#666" },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  historyThumb: { width: 56, height: 56, borderRadius: 12, overflow: "hidden", marginRight: 14 },
  historyThumbImage: { width: "100%", height: "100%" },
  historyThumbPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  historyThumbIcon: { fontSize: 28 },
  historyBody: { flex: 1 },
  historyName: { fontSize: 16, fontWeight: "700", color: "#2C2C2C", marginBottom: 6 },
  historyMeta: { flexDirection: "row", gap: 16 },
  historyMetaText: { fontSize: 13, color: "#555" },
  severityTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  severityText: { fontSize: 12, fontWeight: "600", color: "#FFF" },
  proTipsCard: {
    backgroundColor: "#EFEBE9",
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#D7CCC8",
  },
  proTipsTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  proTipsTitle: { fontSize: 16, fontWeight: "700", color: "#2C2C2C", flex: 1 },
  proTipsInfoIcon: { fontSize: 18 },
  proTipsBullet: { fontSize: 14, color: "#555", marginBottom: 6 },
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
