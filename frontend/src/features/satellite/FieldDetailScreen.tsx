import React, { useEffect, useState } from "react";
import {
  Alert,
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
import {
  deleteFieldBoundary,
  FieldDisplayItem,
  FieldStatus,
  getFieldBoundary,
  toFieldDisplayItem,
} from "./fieldBoundaryService";
import {
  FertilizerRecommendation,
  getFertilizerRecommendation,
} from "./fertilizerRecommendationService";

const OFFSET_WHITE = "#FAFAF8";
const GREEN = "#4CAF50";
const GREEN_LIGHT = "#E8F5E9";

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

export function FieldDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = route.params as { fieldId?: string } | undefined;
  const fieldId = params?.fieldId;
  const { colors } = useTheme();
  const imageHeight = width * 0.45;
  const [field, setField] = useState<FieldDisplayItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCheckingFertilizer, setIsCheckingFertilizer] = useState(false);
  const [fertilizerRecommendation, setFertilizerRecommendation] =
    useState<FertilizerRecommendation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadField() {
      if (!fieldId) {
        setLoadError("Field not found.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setLoadError(null);
        const record = await getFieldBoundary(fieldId);
        if (isMounted) {
          setField(toFieldDisplayItem(record));
        }
      } catch {
        if (isMounted) {
          setLoadError("Could not load this field.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadField();
    return () => {
      isMounted = false;
    };
  }, [fieldId]);

  const deleteField = () => {
    if (!fieldId || !field) {
      return;
    }

    Alert.alert(
      "Delete field",
      `Delete ${field.name}? This will free its saved boundary on the map.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteFieldBoundary(fieldId);
              setIsDeleting(false);
              nav.goBack();
            } catch {
              setIsDeleting(false);
              Alert.alert("Delete failed", "Could not delete this field. Please try again.");
            }
          },
        },
      ],
    );
  };

  const checkFertilizer = async () => {
    if (!fieldId) {
      return;
    }

    try {
      setIsCheckingFertilizer(true);
      const recommendation = await getFertilizerRecommendation(fieldId);
      setFertilizerRecommendation(recommendation);
    } catch {
      Alert.alert(
        "Fertilizer check failed",
        "Could not generate a fertilizer recommendation. Make sure the backend model file is installed.",
      );
    } finally {
      setIsCheckingFertilizer(false);
    }
  };

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
        {isLoading ? <Text style={styles.stateText}>Loading field...</Text> : null}
        {!isLoading && loadError ? <Text style={styles.stateText}>{loadError}</Text> : null}
        {!isLoading && !loadError && field ? (
          <>
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
          <Text style={styles.calendarLine}>Growth stage: {field.growthStage}</Text>
          <Text style={styles.calendarLine}>Field type: {field.fieldType}</Text>
          <Text style={styles.calendarLine}>Categories: {field.cropCategories}</Text>
          <Text style={styles.calendarLine}>Varieties: {field.varieties}</Text>
          <Text style={styles.calendarLine}>Est. Harvest: {field.estHarvest}</Text>
          <Pressable
            style={[styles.fertilizerBtn, isCheckingFertilizer && styles.fertilizerBtnDisabled]}
            onPress={checkFertilizer}
            disabled={isCheckingFertilizer}
          >
            <Text style={styles.fertilizerBtnText}>
              {isCheckingFertilizer ? "Checking..." : "Check Fertilizer"}
            </Text>
          </Pressable>
          {fertilizerRecommendation ? (
            <View style={styles.fertilizerCard}>
              <Text style={styles.fertilizerTitle}>Fertilizer Recommendation</Text>
              <Text style={styles.fertilizerFormula}>{fertilizerRecommendation.formula}</Text>
              <Text style={styles.fertilizerLine}>
                Apply {fertilizerRecommendation.total_fertilizer_kg} kg total
              </Text>
              <Text style={styles.fertilizerExplain}>
                {fertilizerRecommendation.explanation}
              </Text>
            </View>
          ) : null}
          <Pressable
            style={[styles.deleteBtn, isDeleting && styles.deleteBtnDisabled]}
            onPress={deleteField}
            disabled={isDeleting}
          >
            <Text style={styles.deleteBtnText}>{isDeleting ? "Deleting..." : "Delete Field"}</Text>
          </Pressable>
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
          </>
        ) : null}
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
  stateText: { padding: 24, fontSize: 14, color: "#666" },
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
  fertilizerBtn: {
    marginTop: 18,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  fertilizerBtnDisabled: { opacity: 0.7 },
  fertilizerBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  fertilizerCard: {
    marginTop: 14,
    backgroundColor: "#F6FBF6",
    borderWidth: 1,
    borderColor: "#C8E6C9",
    borderRadius: 12,
    padding: 14,
  },
  fertilizerTitle: { fontSize: 13, color: "#555", marginBottom: 4 },
  fertilizerFormula: { fontSize: 20, fontWeight: "700", color: "#2E7D32", marginBottom: 8 },
  fertilizerLine: { fontSize: 14, color: "#2C2C2C", marginBottom: 4 },
  fertilizerExplain: { fontSize: 13, color: "#555", lineHeight: 19, marginTop: 6 },
  deleteBtn: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#E53935",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  deleteBtnDisabled: { opacity: 0.7 },
  deleteBtnText: { color: "#E53935", fontSize: 14, fontWeight: "700" },
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
