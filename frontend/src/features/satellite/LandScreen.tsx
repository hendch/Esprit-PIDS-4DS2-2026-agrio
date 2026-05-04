import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Routes } from "../../core/navigation/routes";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useTheme } from "../../core/theme/useTheme";
import { httpClient } from "../../core/api/httpClient";
import { FieldBoundaryRecord, listFieldBoundaries } from "./fieldBoundaryService";

const OFFSET_WHITE = "#FAFAF8";
const GREEN = "#4CAF50";
const GREEN_LIGHT = "#E8F5E9";
const ORANGE = "#FF9800";
const RED = "#E53935";
const NEUTRAL_FIELD = "#CFD8DC";

type FieldOptimizeResponse = {
  field_id: string;
  farm_id: string;
  field_name: string;
  crop_type: string | null;
  yield_hg_per_ha: number;
  yield_class: string;
  stress_class: string;
  vigor_class: string;
  optimization_priority: string;
  context: {
    governorate?: string | null;
    year?: number;
    irrigated?: boolean;
    crop?: string | null;
    area_ha?: number | null;
    planting_date?: string | null;
    irrigation_method?: string | null;
    field_notes?: string | null;
    centroid_lat?: number | null;
    centroid_lon?: number | null;
    ndvi_mean?: number | null;
    temp_mean?: number | null;
    temp_max?: number | null;
    temp_min?: number | null;
    rain_sum?: number | null;
    temp_stress?: number | null;
  };
};

type FieldHealth = {
  label: string;
  color: string;
  textColor: string;
  ndviLabel: string;
};

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
          <Text style={[styles.tabLabel, active === t.key && styles.tabLabelActive]}>
            {t.key}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function formatDate(value?: string): string {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncateNotes(value?: string, maxLength = 90): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}

function formatYield(hgPerHa: number, areaHa?: number | null) {
  const kgPerHa = hgPerHa * 0.1;
  const tonnesPerHa = kgPerHa / 1000;
  const totalTonnes = areaHa ? tonnesPerHa * areaHa : null;

  return {
    hgPerHa,
    kgPerHa,
    tonnesPerHa,
    totalTonnes,
  };
}

function labelChipColor(label?: string): string {
  const value = (label || "").toLowerCase();

  if (value === "stable") return GREEN;
  if (value === "monitor-closely") return ORANGE;
  if (value === "intervene-soon") return RED;

  if (value.includes("high") || value.includes("strong")) return GREEN;
  if (value.includes("medium") || value.includes("moderate")) return ORANGE;
  if (value.includes("low") || value.includes("poor")) return RED;

  return "#607D8B";
}

function priorityLabel(priority?: string): string {
  if (!priority) return "unknown";
  return priority.replace(/-/g, " ");
}

function fieldHealthFromOptimize(optimize?: FieldOptimizeResponse): FieldHealth {
  const ndvi = optimize?.context.ndvi_mean;
  const priority = optimize?.optimization_priority;

  if (typeof ndvi === "number") {
    if (ndvi >= 0.55) {
      return {
        label: "Healthy",
        color: "#43A047",
        textColor: "#FFF",
        ndviLabel: `NDVI ${ndvi.toFixed(3)}`,
      };
    }

    if (ndvi >= 0.35) {
      return {
        label: "Monitor",
        color: ORANGE,
        textColor: "#1F1F1F",
        ndviLabel: `NDVI ${ndvi.toFixed(3)}`,
      };
    }

    return {
      label: "Needs attention",
      color: RED,
      textColor: "#FFF",
      ndviLabel: `NDVI ${ndvi.toFixed(3)}`,
    };
  }

  if (priority === "intervene-soon") {
    return {
      label: "Needs attention",
      color: RED,
      textColor: "#FFF",
      ndviLabel: "NDVI pending",
    };
  }

  if (priority === "stable") {
    return {
      label: "Healthy",
      color: "#43A047",
      textColor: "#FFF",
      ndviLabel: "NDVI pending",
    };
  }

  return {
    label: "Checking health",
    color: NEUTRAL_FIELD,
    textColor: "#1F1F1F",
    ndviLabel: "NDVI pending",
  };
}

async function optimizeField(
  fieldId: string,
  payload: { year: number; governorate?: string; irrigated?: boolean },
): Promise<FieldOptimizeResponse> {
  const { data } = await httpClient.post<FieldOptimizeResponse>(
    `/api/v1/fields/${fieldId}/optimize`,
    payload,
  );
  return data;
}

export function LandScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();

  const heroHeight = width * 0.34;

  const [fields, setFields] = useState<FieldBoundaryRecord[]>([]);
  const [optimizerByField, setOptimizerByField] = useState<Record<string, FieldOptimizeResponse>>(
    {},
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOptimizer, setIsLoadingOptimizer] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const records = await listFieldBoundaries();
      setFields(records);
      setIsLoading(false);

      setIsLoadingOptimizer(true);

      const results = await Promise.allSettled(
        records.map(async (field) => {
          const result = await optimizeField(field.id, {
            year: new Date().getFullYear(),
            governorate: field.governorate || undefined,
            irrigated: field.irrigated,
          });

          return { fieldId: field.id, result };
        }),
      );

      const nextMap: Record<string, FieldOptimizeResponse> = {};
      results.forEach((item) => {
        if (item.status === "fulfilled") {
          nextMap[item.value.fieldId] = item.value.result;
        }
      });

      setOptimizerByField(nextMap);
    } catch (error) {
      console.error("Failed to load fields:", error);
      setLoadError("Could not load your saved fields.");
    } finally {
      setIsLoading(false);
      setIsLoadingOptimizer(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFields();
    }, [loadFields]),
  );

  const totalArea = fields.reduce((sum, field) => sum + (field.areaHa ?? 0), 0);
  const irrigatedCount = fields.filter((field) => field.irrigated).length;
  const highPriorityCount = Object.values(optimizerByField).filter(
    (opt) => fieldHealthFromOptimize(opt).label === "Needs attention",
  ).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.headerBorder,
          },
        ]}
      >
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
        {/* Summary */}
        <View style={styles.summaryCard}>
          <TouchableOpacity
            style={styles.drawBoundaryBtn}
            onPress={() => nav.navigate(Routes.FieldBoundarySetup)}
          >
            <Text style={styles.drawBoundaryBtnText}>Draw Field Borders on Map</Text>
          </TouchableOpacity>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryIcon}>📐</Text>
              <View>
                <Text style={styles.summaryLabel}>Total Area</Text>
                <Text style={styles.summaryValue}>{totalArea.toFixed(2)} ha</Text>
              </View>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryIcon}>🌱</Text>
              <View>
                <Text style={styles.summaryLabel}>Active Fields</Text>
                <Text style={styles.summaryValue}>{fields.length}</Text>
              </View>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryIcon}>🚨</Text>
              <View>
                <Text style={styles.summaryLabel}>High Priority</Text>
                <Text style={styles.summaryValue}>{highPriorityCount}</Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryMiniRow}>
            <Text style={styles.summaryMiniText}>Irrigated fields: {irrigatedCount}</Text>
            <Text style={styles.summaryMiniText}>
              Optimizer: {isLoadingOptimizer ? "updating..." : "ready"}
            </Text>
          </View>
        </View>

        {/* Field list */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Saved Fields</Text>
            <TouchableOpacity onPress={loadFields}>
              <Text style={styles.refreshIcon}>↻</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={GREEN} />
              <Text style={styles.emptyText}>Loading saved fields...</Text>
            </View>
          ) : null}

          {!isLoading && loadError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{loadError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadFields}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!isLoading && !loadError && fields.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No fields yet</Text>
              <Text style={styles.emptyText}>
                Draw a field border and complete the field profile to save your first field.
              </Text>
            </View>
          ) : null}

          {fields.map((field) => {
            const notesPreview = truncateNotes(field.fieldNotes);
            const optimize = optimizerByField[field.id];
            const health = fieldHealthFromOptimize(optimize);
            const yieldSummary =
              optimize && field.areaHa != null
                ? formatYield(optimize.yield_hg_per_ha, field.areaHa)
                : null;

            return (
              <Pressable
                key={field.id}
                style={styles.fieldCard}
                onPress={() => nav.navigate(Routes.FieldDetail, { fieldId: field.id })}
              >
                <View style={[styles.fieldHero, { height: heroHeight, backgroundColor: health.color }]}>
                  <View style={styles.fieldHeroTop}>
                    <View style={styles.tagGreen}>
                      <Text style={styles.tagText}>{field.name}</Text>
                    </View>

                    <View style={styles.tagLight}>
                      <Text style={styles.tagLightText}>{field.cropType || "Unknown crop"}</Text>
                    </View>
                  </View>

                  <View style={styles.fieldHeroBottom}>
                    <View style={styles.fieldHeroBottomRow}>
                      <View style={styles.tagOutline}>
                        <Text style={styles.tagOutlineText}>
                          {field.areaHa != null ? `${field.areaHa.toFixed(2)} ha` : "Area unavailable"}
                        </Text>
                      </View>

                      <View style={styles.healthTag}>
                        <Text style={[styles.healthTagText, { color: health.textColor }]}>
                          {health.label}
                        </Text>
                        <Text style={[styles.healthTagSubtext, { color: health.textColor }]}>
                          {health.ndviLabel}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.fieldInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Field Health</Text>
                    <Text style={[styles.infoValue, { color: health.color }]}>
                      {health.label} · {health.ndviLabel}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Area</Text>
                    <Text style={styles.infoValue}>
                        {field.areaHa != null ? `${field.areaHa.toFixed(2)} ha` : "Area unavailable"}
                      </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Governorate</Text>
                    <Text style={styles.infoValue}>{field.governorate || "Not set"}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Planting Date</Text>
                    <Text style={styles.infoValue}>{formatDate(field.plantingDate)}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Irrigated</Text>
                    <Text style={styles.infoValue}>{field.irrigated ? "Yes" : "No"}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Irrigation Method</Text>
                    <Text style={styles.infoValue}>{field.irrigationMethod || "Not set"}</Text>
                  </View>

                  {notesPreview ? (
                    <View style={[styles.infoRow, styles.infoRowTop]}>
                      <Text style={styles.infoLabel}>Notes</Text>
                      <Text style={[styles.infoValue, styles.notesValue]}>{notesPreview}</Text>
                    </View>
                  ) : null}

                  <View style={styles.optimizerPreview}>
                    <Text style={styles.optimizerPreviewTitle}>Optimizer Summary</Text>

                    {!optimize && isLoadingOptimizer ? (
                      <Text style={styles.optimizerLoadingText}>Loading optimizer summary...</Text>
                    ) : null}

                    {optimize ? (
                      <>
                        {yieldSummary ? (
                          <Text style={styles.optimizerYieldText}>
                            {yieldSummary.tonnesPerHa.toFixed(2)} t/ha
                          </Text>
                        ) : null}

                        <View style={styles.chipsWrap}>
                          <View
                            style={[
                              styles.statusChip,
                              { backgroundColor: labelChipColor(optimize.yield_class) },
                            ]}
                          >
                            <Text style={styles.statusChipText}>Yield: {optimize.yield_class}</Text>
                          </View>

                          <View
                            style={[
                              styles.statusChip,
                              { backgroundColor: labelChipColor(optimize.stress_class) },
                            ]}
                          >
                            <Text style={styles.statusChipText}>Stress: {optimize.stress_class}</Text>
                          </View>

                          <View
                            style={[
                              styles.statusChip,
                              { backgroundColor: labelChipColor(optimize.vigor_class) },
                            ]}
                          >
                            <Text style={styles.statusChipText}>Vigor: {optimize.vigor_class}</Text>
                          </View>

                          <View
                            style={[
                              styles.statusChip,
                              { backgroundColor: labelChipColor(optimize.optimization_priority) },
                            ]}
                          >
                            <Text style={styles.statusChipText}>
                              Priority: {priorityLabel(optimize.optimization_priority)}
                            </Text>
                          </View>
                        </View>
                      </>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
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
  drawBoundaryBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    alignItems: "center",
  },
  drawBoundaryBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#666",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C2C2C",
  },
  summaryMiniRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryMiniText: {
    fontSize: 12,
    color: "#666",
  },

  section: { marginBottom: 24 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2C2C2C",
  },
  refreshIcon: {
    fontSize: 18,
    color: "#666",
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  emptyState: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEE",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C2C2C",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryBtnText: {
    color: "#FFF",
    fontWeight: "700",
  },

  fieldCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EEE",
  },

  fieldHero: {
    width: "100%",
    position: "relative",
    justifyContent: "space-between",
    padding: 16,
  },
  fieldHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  fieldHeroBottom: {
    alignItems: "flex-start",
  },
  fieldHeroBottomRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
  },
  healthTag: {
    alignItems: "flex-end",
  },
  healthTagText: {
    fontSize: 16,
    fontWeight: "800",
  },
  healthTagSubtext: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },

  tagGreen: {
    backgroundColor: "rgba(46, 125, 50, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  tagText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },

  tagLight: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  tagLightText: {
    color: "#2C2C2C",
    fontWeight: "700",
    fontSize: 13,
  },

  tagOutline: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagOutlineText: {
    color: "#2C2C2C",
    fontWeight: "700",
    fontSize: 13,
  },

  fieldInfo: {
    padding: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  infoRowTop: {
    alignItems: "flex-start",
  },
  infoLabel: {
    fontSize: 13,
    color: "#666",
    marginRight: 12,
    flex: 0.4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2C2C2C",
    flex: 0.6,
    textAlign: "right",
  },
  notesValue: {
    textAlign: "left",
  },

  optimizerPreview: {
    marginTop: 14,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 12,
    padding: 14,
  },
  optimizerPreviewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2C2C2C",
    marginBottom: 8,
  },
  optimizerLoadingText: {
    fontSize: 13,
    color: "#666",
  },
  optimizerYieldText: {
    fontSize: 20,
    fontWeight: "800",
    color: GREEN,
    marginBottom: 8,
  },

  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginTop: 4,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  statusChipText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },

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
