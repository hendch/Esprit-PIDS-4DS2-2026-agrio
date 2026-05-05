import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { cropValueToLabel } from "./fieldVocabulary";

const OFFSET_WHITE = "#FAFAF8";
const GREEN = "#4CAF50";
const GREEN_DARK = "#2E7D32";
const GREEN_LIGHT = "#E8F5E9";
const ORANGE = "#FF9800";
const ORANGE_LIGHT = "#FFF3E0";
const RED = "#E53935";
const RED_LIGHT = "#FFEBEE";
const BLUE = "#1976D2";
const BLUE_LIGHT = "#E3F2FD";
const PURPLE = "#7B1FA2";
const PURPLE_LIGHT = "#F3E5F5";
const GRAY = "#607D8B";
const GRAY_LIGHT = "#ECEFF1";
const DARK_TEXT = "#2C2C2C";

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

type PriorityKey = "intervene-soon" | "monitor-closely" | "stable" | "unknown";

type PriorityMeta = {
  key: PriorityKey;
  label: string;
  color: string;
  lightColor: string;
  emoji: string;
  rank: number;
};

type ActionItem = {
  fieldId: string;
  fieldName: string;
  title: string;
  detail: string;
  priority: PriorityMeta;
};

type FieldDashboardItem = {
  field: FieldBoundaryRecord;
  optimize?: FieldOptimizeResponse;
};

type HelpTopic = {
  title: string;
  body: string;
};

type PerformanceResult = {
  score: number;
  label: string;
  color: string;
  lightColor: string;
  explanation: string;
};

const HELP_TOPICS = {
  performanceIndex: {
    title: "Field Performance Index",
    body:
      "This is a dashboard score from 0 to 100. It combines predicted yield, NDVI, vigor, stress, and optimization priority. It is not a new machine learning model; it is an explainable summary of existing model outputs to help compare fields quickly.",
  },
  ndvi: {
    title: "NDVI",
    body:
      "NDVI is a vegetation index from satellite imagery. Higher values usually indicate stronger green vegetation. Low values may indicate sparse vegetation, bare soil, stress, or uneven crop growth.",
  },
  vigor: {
    title: "Vigor",
    body:
      "Vigor describes how strong the crop vegetation appears based on model context. Strong vigor generally means healthier crop development, while low vigor can indicate weak or uneven growth.",
  },
  stress: {
    title: "Stress",
    body:
      "Stress estimates agronomic pressure on the field. It can reflect heat, water shortage, vegetation weakness, or other signals that may reduce productivity.",
  },
  tonnesPerHectare: {
    title: "t/ha",
    body:
      "t/ha means tonnes per hectare. It estimates how many tonnes of crop yield are expected from one hectare of land.",
  },
  priority: {
    title: "Optimization Priority",
    body:
      "Optimization priority ranks which fields need attention first. Intervene soon means action may be needed quickly, monitor closely means the field should be watched carefully, and stable means the field currently looks acceptable.",
  },
  tempStress: {
    title: "Temperature Stress",
    body:
      "Temperature stress estimates how much weather conditions may pressure the crop. Higher values suggest stronger heat-related risk and may require closer irrigation or field monitoring.",
  },
  stressAlerts: {
    title: "Stress Alerts",
    body:
      "Stress alerts count fields where the optimizer reports high or severe stress indicators. These fields should be checked before stable fields.",
  },
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
    { key: "Community", icon: "👥", route: Routes.Community },
    { key: "Alerts", icon: "🔔", route: Routes.Alerts },
  ];

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 8 }]}> 
      {tabs.map((tab) => (
        <Pressable key={tab.key} onPress={() => nav.navigate(tab.route)} style={styles.tabItem}>
          <View style={[styles.tabIconWrap, active === tab.key && styles.tabIconWrapActive]}>
            <Text style={styles.tabIcon}>{tab.icon}</Text>
          </View>
          <Text style={[styles.tabLabel, active === tab.key && styles.tabLabelActive]}>{tab.key}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function HelpButton({ topic, onPress }: { topic: HelpTopic; onPress: (topic: HelpTopic) => void }) {
  return (
    <TouchableOpacity style={styles.helpButton} onPress={() => onPress(topic)} activeOpacity={0.75}>
      <Text style={styles.helpButtonText}>?</Text>
    </TouchableOpacity>
  );
}

function HelpModal({ topic, onClose }: { topic: HelpTopic | null; onClose: () => void }) {
  return (
    <Modal visible={Boolean(topic)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.helpModalBackdrop}>
        <View style={styles.helpModalCard}>
          <View style={styles.helpModalHeader}>
            <Text style={styles.helpModalTitle}>{topic?.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.helpModalClose}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helpModalBody}>{topic?.body}</Text>
          <TouchableOpacity style={styles.helpModalButton} onPress={onClose}>
            <Text style={styles.helpModalButtonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function SectionHeading({
  title,
  subtitle,
  topic,
  onHelp,
}: {
  title: string;
  subtitle?: string;
  topic?: HelpTopic;
  onHelp: (topic: HelpTopic) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.sectionHeadingTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {topic ? <HelpButton topic={topic} onPress={onHelp} /> : null}
      </View>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncateNotes(value?: string, maxLength = 86): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}

function formatYield(hgPerHa: number, areaHa?: number | null) {
  const kgPerHa = hgPerHa * 0.1;
  const tonnesPerHa = kgPerHa / 1000;
  const totalTonnes = areaHa ? tonnesPerHa * areaHa : null;
  return { hgPerHa, kgPerHa, tonnesPerHa, totalTonnes };
}

function normalizePriority(value?: string | null): PriorityKey {
  if (value === "intervene-soon") return "intervene-soon";
  if (value === "monitor-closely") return "monitor-closely";
  if (value === "stable") return "stable";
  return "unknown";
}

function priorityMeta(value?: string | null): PriorityMeta {
  const key = normalizePriority(value);
  switch (key) {
    case "intervene-soon":
      return { key, label: "Intervene soon", color: RED, lightColor: RED_LIGHT, emoji: "🚨", rank: 3 };
    case "monitor-closely":
      return { key, label: "Monitor closely", color: ORANGE, lightColor: ORANGE_LIGHT, emoji: "⚠️", rank: 2 };
    case "stable":
      return { key, label: "Stable", color: GREEN, lightColor: GREEN_LIGHT, emoji: "✅", rank: 1 };
    default:
      return { key, label: "Pending", color: GRAY, lightColor: GRAY_LIGHT, emoji: "⏳", rank: 0 };
  }
}

function labelChipColor(label?: string | null): string {
  const value = (label || "").toLowerCase();
  if (value === "stable") return GREEN;
  if (value === "monitor-closely") return ORANGE;
  if (value === "intervene-soon") return RED;
  if (value.includes("high") || value.includes("strong") || value.includes("good")) return GREEN;
  if (value.includes("medium") || value.includes("moderate")) return ORANGE;
  if (value.includes("low") || value.includes("poor") || value.includes("weak")) return RED;
  return GRAY;
}

function classScore(label?: string | null, mode: "positive" | "negative" = "positive"): number {
  const value = (label || "").toLowerCase();
  if (!value) return 50;

  const high = value.includes("high") || value.includes("strong") || value.includes("good");
  const medium = value.includes("medium") || value.includes("moderate");
  const low = value.includes("low") || value.includes("poor") || value.includes("weak") || value.includes("severe");

  if (mode === "positive") {
    if (high) return 90;
    if (medium) return 62;
    if (low) return 28;
  } else {
    if (high || low || value.includes("severe")) return 25;
    if (medium) return 58;
    return 88;
  }

  return 50;
}

function priorityScore(priority?: string | null): number {
  const key = normalizePriority(priority);
  if (key === "stable") return 92;
  if (key === "monitor-closely") return 58;
  if (key === "intervene-soon") return 25;
  return 50;
}

function chipLabel(value?: string | null): string {
  if (!value) return "Pending";
  return value.replace(/-/g, " ");
}

function safeAverage(values: Array<number | null | undefined>): number | null {
  const numbers = values.filter((value): value is number => typeof value === "number");
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function ndviLabel(value?: number | null): string {
  if (value == null) return "NDVI pending";
  return `NDVI ${value.toFixed(3)}`;
}

function ndviHealthLabel(value?: number | null): string {
  if (value == null) return "Unknown";
  if (value >= 0.55) return "Strong vegetation";
  if (value >= 0.35) return "Moderate vegetation";
  return "Weak vegetation";
}

function performanceMeta(score: number): Pick<PerformanceResult, "label" | "color" | "lightColor" | "explanation"> {
  if (score >= 80) {
    return {
      label: "Strong",
      color: GREEN,
      lightColor: GREEN_LIGHT,
      explanation: "Strong combined yield, vegetation, vigor, stress, and priority signals.",
    };
  }
  if (score >= 60) {
    return {
      label: "Good",
      color: BLUE,
      lightColor: BLUE_LIGHT,
      explanation: "Good performance with some signals to keep monitoring.",
    };
  }
  if (score >= 40) {
    return {
      label: "Moderate risk",
      color: ORANGE,
      lightColor: ORANGE_LIGHT,
      explanation: "Moderate risk. The field may need closer observation or targeted action.",
    };
  }
  return {
    label: "Needs action",
    color: RED,
    lightColor: RED_LIGHT,
    explanation: "Low combined performance. The field should be prioritized for inspection.",
  };
}

function calculatePerformanceScore(optimize?: FieldOptimizeResponse, maxYieldHgPerHa = 1): PerformanceResult {
  if (!optimize) {
    return {
      score: 0,
      label: "Pending",
      color: GRAY,
      lightColor: GRAY_LIGHT,
      explanation: "Optimizer data is not available yet.",
    };
  }

  const yieldScore = Math.min(100, Math.max(0, (optimize.yield_hg_per_ha / Math.max(maxYieldHgPerHa, 1)) * 100));
  const ndviScore = typeof optimize.context.ndvi_mean === "number" ? Math.min(100, Math.max(0, optimize.context.ndvi_mean * 100)) : 50;
  const vigorScore = classScore(optimize.vigor_class, "positive");
  const stressScore = classScore(optimize.stress_class, "negative");
  const priorityComponent = priorityScore(optimize.optimization_priority);
  const tempStressPenalty = typeof optimize.context.temp_stress === "number" ? Math.min(18, optimize.context.temp_stress * 18) : 0;

  const rawScore =
    yieldScore * 0.32 +
    ndviScore * 0.24 +
    vigorScore * 0.2 +
    stressScore * 0.14 +
    priorityComponent * 0.1 -
    tempStressPenalty;

  const score = Math.round(Math.max(0, Math.min(100, rawScore)));
  const meta = performanceMeta(score);

  return { score, ...meta };
}

function buildFieldAction(field: FieldBoundaryRecord, optimize?: FieldOptimizeResponse): ActionItem {
  const meta = priorityMeta(optimize?.optimization_priority);
  const cropLabel = cropValueToLabel(field.cropType || optimize?.crop_type || optimize?.context.crop);

  if (!optimize) {
    return {
      fieldId: field.id,
      fieldName: field.name,
      title: `Complete intelligence check for ${field.name}`,
      detail: `${cropLabel} optimizer data is still loading or unavailable.`,
      priority: meta,
    };
  }

  const ndvi = optimize.context.ndvi_mean;
  const stress = optimize.stress_class;
  const vigor = optimize.vigor_class;
  const tempStress = optimize.context.temp_stress;
  const rain = optimize.context.rain_sum;

  if (meta.key === "intervene-soon") {
    return {
      fieldId: field.id,
      fieldName: field.name,
      title: `Inspect ${field.name} first`,
      detail: `${cropLabel} is classified as ${stress} stress with ${vigor} vigor. Check irrigation, nutrition, and visible field symptoms.`,
      priority: meta,
    };
  }

  if (meta.key === "monitor-closely") {
    return {
      fieldId: field.id,
      fieldName: field.name,
      title: `Monitor ${field.name} this week`,
      detail: `${cropLabel} needs close observation. NDVI: ${ndvi != null ? ndvi.toFixed(3) : "pending"}, rain: ${rain != null ? `${rain.toFixed(1)} mm` : "pending"}.`,
      priority: meta,
    };
  }

  if (typeof ndvi === "number" && ndvi < 0.35) {
    return {
      fieldId: field.id,
      fieldName: field.name,
      title: `Review vegetation in ${field.name}`,
      detail: `NDVI is ${ndvi.toFixed(3)}, which suggests weak or uneven vegetation development.`,
      priority: { ...meta, key: "monitor-closely", label: "Monitor closely", color: ORANGE, lightColor: ORANGE_LIGHT, emoji: "⚠️", rank: 2 },
    };
  }

  if (typeof tempStress === "number" && tempStress > 0.65) {
    return {
      fieldId: field.id,
      fieldName: field.name,
      title: `Watch heat stress in ${field.name}`,
      detail: `Temperature stress is ${tempStress.toFixed(2)}. Prioritize water management if dry conditions continue.`,
      priority: { ...meta, key: "monitor-closely", label: "Monitor closely", color: ORANGE, lightColor: ORANGE_LIGHT, emoji: "🌡️", rank: 2 },
    };
  }

  return {
    fieldId: field.id,
    fieldName: field.name,
    title: `${field.name} is currently stable`,
    detail: `${cropLabel} signals are acceptable. Keep regular monitoring and compare with the next optimizer refresh.`,
    priority: meta,
  };
}

function buildDashboardItems(fields: FieldBoundaryRecord[], optimizerByField: Record<string, FieldOptimizeResponse>): FieldDashboardItem[] {
  return fields.map((field) => ({ field, optimize: optimizerByField[field.id] }));
}

async function optimizeField(
  fieldId: string,
  payload: { year: number; governorate?: string; irrigated?: boolean },
): Promise<FieldOptimizeResponse> {
  const { data } = await httpClient.post<FieldOptimizeResponse>(`/api/v1/fields/${fieldId}/optimize`, payload);
  return data;
}

function KpiCard({
  emoji,
  label,
  value,
  accentColor,
  backgroundColor,
  topic,
  onHelp,
}: {
  emoji: string;
  label: string;
  value: string;
  accentColor: string;
  backgroundColor: string;
  topic?: HelpTopic;
  onHelp: (topic: HelpTopic) => void;
}) {
  return (
    <View style={[styles.kpiCard, { backgroundColor }]}> 
      <View style={styles.kpiTopRow}>
        <View style={[styles.kpiIcon, { backgroundColor: accentColor }]}> 
          <Text style={styles.kpiEmoji}>{emoji}</Text>
        </View>
        {topic ? <HelpButton topic={topic} onPress={onHelp} /> : null}
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color: accentColor }]}>{value}</Text>
    </View>
  );
}

function MiniMetric({ label, value, topic, onHelp }: { label: string; value: string; topic?: HelpTopic; onHelp: (topic: HelpTopic) => void }) {
  return (
    <View style={styles.miniMetric}>
      <View style={styles.miniMetricLabelRow}>
        <Text style={styles.miniMetricLabel}>{label}</Text>
        {topic ? <HelpButton topic={topic} onPress={onHelp} /> : null}
      </View>
      <Text style={styles.miniMetricValue}>{value}</Text>
    </View>
  );
}

function PriorityBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const widthPct = total > 0 ? Math.max(4, (count / total) * 100) : 0;
  return (
    <View style={styles.priorityBarRow}>
      <View style={styles.priorityBarHeader}>
        <Text style={styles.priorityBarLabel}>{label}</Text>
        <Text style={styles.priorityBarCount}>{count}</Text>
      </View>
      <View style={styles.priorityBarTrack}>
        <View style={[styles.priorityBarFill, { width: `${widthPct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function FieldMetric({ label, value, topic, onHelp }: { label: string; value: string; topic?: HelpTopic; onHelp: (topic: HelpTopic) => void }) {
  return (
    <View style={styles.fieldMetric}>
      <View style={styles.fieldMetricLabelRow}>
        <Text style={styles.fieldMetricLabel}>{label}</Text>
        {topic ? <HelpButton topic={topic} onPress={onHelp} /> : null}
      </View>
      <Text style={styles.fieldMetricValue}>{value}</Text>
    </View>
  );
}

function PerformanceRow({
  item,
  maxYield,
  onPress,
  onHelp,
}: {
  item: FieldDashboardItem;
  maxYield: number;
  onPress: () => void;
  onHelp: (topic: HelpTopic) => void;
}) {
  const performance = calculatePerformanceScore(item.optimize, maxYield);
  const cropLabel = cropValueToLabel(item.field.cropType || item.optimize?.crop_type || item.optimize?.context.crop);

  return (
    <Pressable style={styles.performanceRow} onPress={onPress}>
      <View style={styles.performanceHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.performanceFieldName}>{item.field.name}</Text>
          <Text style={styles.performanceCrop}>{cropLabel}</Text>
        </View>
        <View style={[styles.performanceScoreBadge, { backgroundColor: performance.lightColor }]}> 
          <Text style={[styles.performanceScoreText, { color: performance.color }]}>{performance.score}/100</Text>
        </View>
      </View>

      <View style={styles.performanceBarTrack}>
        <View style={[styles.performanceBarFill, { width: `${performance.score}%`, backgroundColor: performance.color }]} />
      </View>

      <View style={styles.performanceFooterRow}>
        <Text style={[styles.performanceLabel, { color: performance.color }]}>{performance.label}</Text>
        <HelpButton topic={HELP_TOPICS.performanceIndex} onPress={onHelp} />
      </View>
      <Text style={styles.performanceExplanation}>{performance.explanation}</Text>
    </Pressable>
  );
}

export function LandScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const heroHeight = Math.max(150, width * 0.34);

  const [fields, setFields] = useState<FieldBoundaryRecord[]>([]);
  const [optimizerByField, setOptimizerByField] = useState<Record<string, FieldOptimizeResponse>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOptimizer, setIsLoadingOptimizer] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);

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
        if (item.status === "fulfilled") nextMap[item.value.fieldId] = item.value.result;
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

  const dashboardItems = useMemo(() => buildDashboardItems(fields, optimizerByField), [fields, optimizerByField]);
  const totalArea = useMemo(() => fields.reduce((sum, field) => sum + (field.areaHa ?? 0), 0), [fields]);
  const irrigatedCount = useMemo(() => fields.filter((field) => field.irrigated).length, [fields]);
  const optimizerValues = Object.values(optimizerByField);
  const maxYieldHgPerHa = useMemo(() => Math.max(1, ...optimizerValues.map((opt) => opt.yield_hg_per_ha || 0)), [optimizerValues]);

  const performanceResults = useMemo(
    () => dashboardItems.map((item) => calculatePerformanceScore(item.optimize, maxYieldHgPerHa)),
    [dashboardItems, maxYieldHgPerHa],
  );
  const averagePerformance = useMemo(() => safeAverage(performanceResults.map((result) => result.score)), [performanceResults]);

  const averageYieldTonnesHa = useMemo(() => {
    const values = dashboardItems
      .map((item) => (item.optimize ? formatYield(item.optimize.yield_hg_per_ha, item.field.areaHa).tonnesPerHa : null))
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [dashboardItems]);

  const totalExpectedTonnes = useMemo(() => {
    const values = dashboardItems
      .map((item) => (item.optimize && item.field.areaHa ? formatYield(item.optimize.yield_hg_per_ha, item.field.areaHa).totalTonnes : null))
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0);
  }, [dashboardItems]);

  const averageNdvi = useMemo(() => safeAverage(optimizerValues.map((optimize) => optimize.context.ndvi_mean)), [optimizerValues]);
  const averageTempStress = useMemo(() => safeAverage(optimizerValues.map((optimize) => optimize.context.temp_stress)), [optimizerValues]);

  const priorityCounts = useMemo(() => {
    const counts: Record<PriorityKey, number> = { "intervene-soon": 0, "monitor-closely": 0, stable: 0, unknown: 0 };
    dashboardItems.forEach((item) => {
      const key = normalizePriority(item.optimize?.optimization_priority);
      counts[key] += 1;
    });
    return counts;
  }, [dashboardItems]);

  const stressAlerts = useMemo(() => {
    return optimizerValues.filter((optimize) => {
      const stress = optimize.stress_class.toLowerCase();
      return stress.includes("high") || stress.includes("poor") || stress.includes("severe");
    }).length;
  }, [optimizerValues]);

  const actionQueue = useMemo(() => {
    return dashboardItems
      .map((item) => buildFieldAction(item.field, item.optimize))
      .sort((a, b) => b.priority.rank - a.priority.rank)
      .slice(0, 5);
  }, [dashboardItems]);

  const bestYieldField = useMemo(() => {
    const sorted = dashboardItems
      .filter((item) => item.optimize)
      .sort((a, b) => (b.optimize?.yield_hg_per_ha ?? 0) - (a.optimize?.yield_hg_per_ha ?? 0));
    return sorted[0] ?? null;
  }, [dashboardItems]);

  const performanceSortedItems = useMemo(() => {
    return [...dashboardItems].sort(
      (a, b) =>
        calculatePerformanceScore(b.optimize, maxYieldHgPerHa).score -
        calculatePerformanceScore(a.optimize, maxYieldHgPerHa).score,
    );
  }, [dashboardItems, maxYieldHgPerHa]);

  const dashboardReadyCount = optimizerValues.length;

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
        <Text style={styles.headerRight}>Command Center</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: 104 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>Land Command Center</Text>
              <Text style={styles.heroTitle}>AI-powered farm priorities</Text>
              <Text style={styles.heroSubtitle}>Uses optimizer outputs, NDVI context, weather stress, crop profile, and field boundaries to prioritize farm actions.</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeValue}>{dashboardReadyCount}/{fields.length}</Text>
              <Text style={styles.heroBadgeLabel}>optimized</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.drawBoundaryBtn} onPress={() => nav.navigate(Routes.FieldBoundarySetup)}>
            <Text style={styles.drawBoundaryBtnText}>Draw Field Borders on Map</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.kpiGrid}>
          <KpiCard emoji="📊" label="Avg performance" value={averagePerformance != null ? `${averagePerformance.toFixed(0)}/100` : "—"} accentColor={GREEN} backgroundColor={GREEN_LIGHT} topic={HELP_TOPICS.performanceIndex} onHelp={setHelpTopic} />
          <KpiCard emoji="🌾" label="Avg yield" value={averageYieldTonnesHa != null ? `${averageYieldTonnesHa.toFixed(2)} t/ha` : "—"} accentColor={BLUE} backgroundColor={BLUE_LIGHT} topic={HELP_TOPICS.tonnesPerHectare} onHelp={setHelpTopic} />
          <KpiCard emoji="🚨" label="Stress alerts" value={`${stressAlerts}`} accentColor={RED} backgroundColor={RED_LIGHT} topic={HELP_TOPICS.stressAlerts} onHelp={setHelpTopic} />
          <KpiCard emoji="🛰️" label="Avg NDVI" value={averageNdvi != null ? averageNdvi.toFixed(3) : "—"} accentColor={PURPLE} backgroundColor={PURPLE_LIGHT} topic={HELP_TOPICS.ndvi} onHelp={setHelpTopic} />
        </View>

        <View style={styles.insightCard}>
          <View style={styles.sectionTitleRow}>
            <SectionHeading title="Farm Intelligence" subtitle="Aggregated from all optimized fields" onHelp={setHelpTopic} />
            <TouchableOpacity onPress={loadFields}><Text style={styles.refreshIcon}>↻</Text></TouchableOpacity>
          </View>
          <View style={styles.intelligenceGrid}>
            <MiniMetric label="Active fields" value={`${fields.length}`} onHelp={setHelpTopic} />
            <MiniMetric label="Irrigated fields" value={`${irrigatedCount}`} onHelp={setHelpTopic} />
            <MiniMetric label="Total production" value={totalExpectedTonnes != null ? `${totalExpectedTonnes.toFixed(2)} t` : "—"} topic={HELP_TOPICS.tonnesPerHectare} onHelp={setHelpTopic} />
            <MiniMetric label="Temp stress" value={averageTempStress != null ? averageTempStress.toFixed(2) : "—"} topic={HELP_TOPICS.tempStress} onHelp={setHelpTopic} />
            <MiniMetric label="Optimizer" value={isLoadingOptimizer ? "updating" : dashboardReadyCount > 0 ? "ready" : "pending"} onHelp={setHelpTopic} />
            <MiniMetric label="Total area" value={`${totalArea.toFixed(2)} ha`} onHelp={setHelpTopic} />
          </View>
          {bestYieldField?.optimize ? (
            <View style={styles.bestFieldBox}>
              <Text style={styles.bestFieldTitle}>Best predicted field</Text>
              <Text style={styles.bestFieldValue}>{bestYieldField.field.name} · {formatYield(bestYieldField.optimize.yield_hg_per_ha, bestYieldField.field.areaHa).tonnesPerHa.toFixed(2)} t/ha</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.performanceCard}>
          <SectionHeading title="Field Performance Index" subtitle="Combined score from yield, NDVI, vigor, stress, and priority" topic={HELP_TOPICS.performanceIndex} onHelp={setHelpTopic} />
          {isLoading || isLoadingOptimizer ? <View style={styles.loadingRow}><ActivityIndicator size="small" color={GREEN} /><Text style={styles.emptyText}>Calculating performance index...</Text></View> : null}
          {!isLoading && fields.length === 0 ? <Text style={styles.emptyText}>Add fields to generate performance scores.</Text> : null}
          {performanceSortedItems.map((item) => <PerformanceRow key={item.field.id} item={item} maxYield={maxYieldHgPerHa} onHelp={setHelpTopic} onPress={() => nav.navigate(Routes.FieldDetail, { fieldId: item.field.id })} />)}
        </View>

        <View style={styles.chartCard}>
          <SectionHeading title="Priority Distribution" subtitle="How many fields need action now?" topic={HELP_TOPICS.priority} onHelp={setHelpTopic} />
          <PriorityBar label="Intervene soon" count={priorityCounts["intervene-soon"]} total={Math.max(fields.length, 1)} color={RED} />
          <PriorityBar label="Monitor closely" count={priorityCounts["monitor-closely"]} total={Math.max(fields.length, 1)} color={ORANGE} />
          <PriorityBar label="Stable" count={priorityCounts.stable} total={Math.max(fields.length, 1)} color={GREEN} />
          <PriorityBar label="Pending" count={priorityCounts.unknown} total={Math.max(fields.length, 1)} color={GRAY} />
        </View>

        <View style={styles.actionQueueCard}>
          <SectionHeading title="AI Action Queue" subtitle="Suggested order of attention based on priority, stress, vigor, NDVI, and weather context." topic={HELP_TOPICS.priority} onHelp={setHelpTopic} />
          {isLoading || isLoadingOptimizer ? <View style={styles.loadingRow}><ActivityIndicator size="small" color={GREEN} /><Text style={styles.emptyText}>Building action queue...</Text></View> : null}
          {!isLoading && fields.length === 0 ? <Text style={styles.emptyText}>Draw a field border and complete its profile to generate farm actions.</Text> : null}
          {!isLoading && fields.length > 0 && actionQueue.map((action, index) => (
            <Pressable key={`${action.fieldId}-${index}`} style={[styles.actionItem, { borderLeftColor: action.priority.color }]} onPress={() => nav.navigate(Routes.FieldDetail, { fieldId: action.fieldId })}>
              <View style={[styles.actionRank, { backgroundColor: action.priority.lightColor }]}><Text style={styles.actionRankText}>{index + 1}</Text></View>
              <View style={styles.actionContent}>
                <View style={styles.actionTitleRow}><Text style={styles.actionTitle}>{action.title}</Text><Text style={[styles.actionPriority, { color: action.priority.color }]}>{action.priority.emoji}</Text></View>
                <Text style={styles.actionDetail}>{action.detail}</Text>
                <Text style={[styles.actionLabel, { color: action.priority.color }]}>{action.priority.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <SectionHeading title="Fields" subtitle="Model-enriched field cards" onHelp={setHelpTopic} />
            <TouchableOpacity onPress={loadFields}><Text style={styles.refreshIcon}>↻</Text></TouchableOpacity>
          </View>

          {isLoading ? <View style={styles.loadingRow}><ActivityIndicator size="small" color={GREEN} /><Text style={styles.emptyText}>Loading saved fields...</Text></View> : null}
          {!isLoading && loadError ? <View style={styles.emptyState}><Text style={styles.emptyText}>{loadError}</Text><TouchableOpacity style={styles.retryBtn} onPress={loadFields}><Text style={styles.retryBtnText}>Retry</Text></TouchableOpacity></View> : null}
          {!isLoading && !loadError && fields.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>No fields yet</Text><Text style={styles.emptyText}>Draw a field border and complete the field profile to save your first field.</Text></View> : null}

          {dashboardItems.map((item) => {
            const { field, optimize } = item;
            const notesPreview = truncateNotes(field.fieldNotes);
            const meta = priorityMeta(optimize?.optimization_priority);
            const performance = calculatePerformanceScore(optimize, maxYieldHgPerHa);
            const cropLabel = cropValueToLabel(field.cropType || optimize?.crop_type || optimize?.context.crop);
            const yieldSummary = optimize && field.areaHa != null ? formatYield(optimize.yield_hg_per_ha, field.areaHa) : null;

            return (
              <Pressable key={field.id} style={styles.fieldCard} onPress={() => nav.navigate(Routes.FieldDetail, { fieldId: field.id })}>
                <View style={[styles.fieldHero, { height: heroHeight, backgroundColor: meta.color }]}> 
                  <View style={styles.fieldHeroTop}>
                    <View style={styles.tagGreen}><Text style={styles.tagText}>{field.name}</Text></View>
                    <View style={styles.tagLight}><Text style={styles.tagLightText}>{cropLabel}</Text></View>
                  </View>
                  <View style={styles.fieldHeroBottom}>
                    <View style={styles.fieldHeroBottomRow}>
                      <View style={styles.tagOutline}><Text style={styles.tagOutlineText}>{field.areaHa != null ? `${field.areaHa.toFixed(2)} ha` : "Area unavailable"}</Text></View>
                      <View style={styles.healthTag}><Text style={styles.healthTagText}>{meta.emoji} {meta.label}</Text><Text style={styles.healthTagSubtext}>{performance.score}/100 · {performance.label}</Text></View>
                    </View>
                  </View>
                </View>

                <View style={styles.fieldInfo}>
                  <View style={styles.fieldCardHeaderRow}>
                    <View><Text style={styles.fieldName}>{field.name}</Text><Text style={styles.fieldCrop}>{cropLabel}</Text></View>
                    <View style={[styles.priorityPill, { backgroundColor: meta.lightColor }]}><Text style={[styles.priorityPillText, { color: meta.color }]}>{meta.label}</Text></View>
                  </View>

                  <View style={styles.fieldMetricGrid}>
                    <FieldMetric label="Performance" value={`${performance.score}/100`} topic={HELP_TOPICS.performanceIndex} onHelp={setHelpTopic} />
                    <FieldMetric label="Yield" value={yieldSummary ? `${yieldSummary.tonnesPerHa.toFixed(2)} t/ha` : "—"} topic={HELP_TOPICS.tonnesPerHectare} onHelp={setHelpTopic} />
                    <FieldMetric label="NDVI" value={optimize?.context.ndvi_mean != null ? optimize.context.ndvi_mean.toFixed(3) : "—"} topic={HELP_TOPICS.ndvi} onHelp={setHelpTopic} />
                    <FieldMetric label="Temp stress" value={optimize?.context.temp_stress != null ? optimize.context.temp_stress.toFixed(2) : "—"} topic={HELP_TOPICS.tempStress} onHelp={setHelpTopic} />
                  </View>

                  <View style={styles.chipsWrap}>
                    <View style={[styles.statusChip, { backgroundColor: labelChipColor(optimize?.yield_class) }]}><Text style={styles.statusChipText}>Yield: {chipLabel(optimize?.yield_class)}</Text></View>
                    <View style={[styles.statusChip, { backgroundColor: labelChipColor(optimize?.stress_class) }]}><Text style={styles.statusChipText}>Stress: {chipLabel(optimize?.stress_class)}</Text></View>
                    <View style={[styles.statusChip, { backgroundColor: labelChipColor(optimize?.vigor_class) }]}><Text style={styles.statusChipText}>Vigor: {chipLabel(optimize?.vigor_class)}</Text></View>
                  </View>

                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Governorate</Text><Text style={styles.infoValue}>{field.governorate || optimize?.context.governorate || "Not set"}</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Planting Date</Text><Text style={styles.infoValue}>{formatDate(field.plantingDate)}</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Irrigation</Text><Text style={styles.infoValue}>{field.irrigated ? field.irrigationMethod || "Irrigated" : "Rainfed / None"}</Text></View>
                  <View style={styles.infoRow}><Text style={styles.infoLabel}>Vegetation</Text><Text style={styles.infoValue}>{ndviHealthLabel(optimize?.context.ndvi_mean)}</Text></View>

                  {notesPreview ? <View style={[styles.infoRow, styles.infoRowTop]}><Text style={styles.infoLabel}>Notes</Text><Text style={[styles.infoValue, styles.notesValue]}>{notesPreview}</Text></View> : null}
                  {!optimize && isLoadingOptimizer ? <View style={styles.optimizerPendingBox}><ActivityIndicator size="small" color={GREEN} /><Text style={styles.optimizerPendingText}>Loading optimizer summary...</Text></View> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <HelpModal topic={helpTopic} onClose={() => setHelpTopic(null)} />
      <TabBar active="Land" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OFFSET_WHITE },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: OFFSET_WHITE, borderBottomWidth: 1, borderBottomColor: "#EEE" },
  hamburger: { fontSize: 22, color: DARK_TEXT },
  headerCenter: { flexDirection: "row", alignItems: "center" },
  logoIcon: { fontSize: 24, marginRight: 6 },
  logoText: { fontSize: 20, fontWeight: "700", color: GREEN },
  headerRight: { fontSize: 13, color: "#666", fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 18 },
  heroCard: { backgroundColor: GREEN_DARK, borderRadius: 22, padding: 20, marginBottom: 16 },
  heroTopRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  heroEyebrow: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  heroTitle: { color: "#FFF", fontSize: 26, fontWeight: "900", lineHeight: 31 },
  heroSubtitle: { color: "rgba(255,255,255,0.86)", fontSize: 13, lineHeight: 19, marginTop: 8 },
  heroBadge: { minWidth: 78, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10, alignItems: "center" },
  heroBadgeValue: { color: "#FFF", fontSize: 20, fontWeight: "900" },
  heroBadgeLabel: { color: "rgba(255,255,255,0.78)", fontSize: 11, marginTop: 2 },
  drawBoundaryBtn: { backgroundColor: "#FFF", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginTop: 18, alignItems: "center" },
  drawBoundaryBtnText: { color: GREEN_DARK, fontSize: 14, fontWeight: "900" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  kpiCard: { width: "48%", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "rgba(0,0,0,0.04)" },
  kpiTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  kpiIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  kpiEmoji: { fontSize: 18 },
  kpiLabel: { fontSize: 12, color: "#666", fontWeight: "700", marginBottom: 4 },
  kpiValue: { fontSize: 20, fontWeight: "900" },
  helpButton: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.08)", alignItems: "center", justifyContent: "center" },
  helpButtonText: { fontSize: 13, fontWeight: "900", color: "#555" },
  helpModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.38)", alignItems: "center", justifyContent: "center", padding: 24 },
  helpModalCard: { width: "100%", backgroundColor: "#FFF", borderRadius: 20, padding: 18 },
  helpModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  helpModalTitle: { fontSize: 18, fontWeight: "900", color: DARK_TEXT, flex: 1, paddingRight: 10 },
  helpModalClose: { fontSize: 26, color: "#777", fontWeight: "700" },
  helpModalBody: { fontSize: 14, color: "#444", lineHeight: 21 },
  helpModalButton: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 11, alignItems: "center", marginTop: 16 },
  helpModalButtonText: { color: "#FFF", fontWeight: "900" },
  sectionHeadingTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  insightCard: { backgroundColor: "#FFF", borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#EEE" },
  intelligenceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  miniMetric: { width: "48%", backgroundColor: "#F7F8F4", borderRadius: 14, padding: 12 },
  miniMetricLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  miniMetricLabel: { fontSize: 12, color: "#666", fontWeight: "700" },
  miniMetricValue: { fontSize: 16, fontWeight: "900", color: DARK_TEXT, marginTop: 4 },
  bestFieldBox: { backgroundColor: GREEN_LIGHT, borderRadius: 14, padding: 12, marginTop: 14 },
  bestFieldTitle: { fontSize: 12, color: "#47634A", fontWeight: "800" },
  bestFieldValue: { fontSize: 15, color: GREEN_DARK, fontWeight: "900", marginTop: 4 },
  performanceCard: { backgroundColor: "#FFF", borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#EEE" },
  performanceRow: { marginTop: 14, backgroundColor: "#FAFAF8", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#EEE" },
  performanceHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  performanceFieldName: { fontSize: 15, fontWeight: "900", color: DARK_TEXT },
  performanceCrop: { fontSize: 12, color: "#666", marginTop: 2, fontWeight: "700" },
  performanceScoreBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  performanceScoreText: { fontSize: 12, fontWeight: "900" },
  performanceBarTrack: { height: 12, backgroundColor: "#EEF0EA", borderRadius: 999, overflow: "hidden", marginTop: 12 },
  performanceBarFill: { height: "100%", borderRadius: 999 },
  performanceFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 9 },
  performanceLabel: { fontSize: 13, fontWeight: "900" },
  performanceExplanation: { fontSize: 12, color: "#666", lineHeight: 17, marginTop: 5 },
  chartCard: { backgroundColor: "#FFF", borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#EEE" },
  priorityBarRow: { marginTop: 14 },
  priorityBarHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  priorityBarLabel: { fontSize: 13, color: "#333", fontWeight: "800" },
  priorityBarCount: { fontSize: 13, color: "#666", fontWeight: "900" },
  priorityBarTrack: { height: 10, backgroundColor: "#EEF0EA", borderRadius: 999, overflow: "hidden" },
  priorityBarFill: { height: "100%", borderRadius: 999 },
  actionQueueCard: { backgroundColor: "#FFF", borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#EEE" },
  actionItem: { flexDirection: "row", gap: 12, paddingVertical: 14, paddingHorizontal: 10, borderLeftWidth: 4, borderRadius: 12, backgroundColor: "#FAFAF8", marginTop: 12 },
  actionRank: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  actionRankText: { fontSize: 14, color: DARK_TEXT, fontWeight: "900" },
  actionContent: { flex: 1 },
  actionTitleRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  actionTitle: { flex: 1, fontSize: 14, color: DARK_TEXT, fontWeight: "900" },
  actionPriority: { fontSize: 18 },
  actionDetail: { fontSize: 12, color: "#666", lineHeight: 18, marginTop: 5 },
  actionLabel: { fontSize: 12, fontWeight: "900", marginTop: 7 },
  section: { marginBottom: 24 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 19, fontWeight: "900", color: DARK_TEXT },
  sectionSubtitle: { fontSize: 12, color: "#777", marginTop: 3, lineHeight: 17 },
  refreshIcon: { fontSize: 20, color: "#666", fontWeight: "900" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  emptyState: { backgroundColor: "#FFF", borderRadius: 12, padding: 18, borderWidth: 1, borderColor: "#EEE", marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: DARK_TEXT, marginBottom: 6 },
  emptyText: { fontSize: 14, color: "#666", lineHeight: 20 },
  retryBtn: { marginTop: 12, alignSelf: "flex-start", backgroundColor: GREEN, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  retryBtnText: { color: "#FFF", fontWeight: "700" },
  fieldCard: { backgroundColor: "#FFF", borderRadius: 18, overflow: "hidden", marginBottom: 18, borderWidth: 1, borderColor: "#EEE" },
  fieldHero: { width: "100%", position: "relative", justifyContent: "space-between", padding: 16 },
  fieldHeroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  fieldHeroBottom: { alignItems: "flex-start" },
  fieldHeroBottomRow: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 10 },
  healthTag: { alignItems: "flex-end", maxWidth: "58%" },
  healthTagText: { fontSize: 15, fontWeight: "900", color: "#FFF", textAlign: "right" },
  healthTagSubtext: { fontSize: 12, fontWeight: "800", color: "rgba(255,255,255,0.86)", marginTop: 2 },
  tagGreen: { backgroundColor: "rgba(46, 125, 50, 0.92)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  tagText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  tagLight: { backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, maxWidth: "56%" },
  tagLightText: { color: DARK_TEXT, fontWeight: "800", fontSize: 13 },
  tagOutline: { backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  tagOutlineText: { color: DARK_TEXT, fontWeight: "800", fontSize: 13 },
  fieldInfo: { padding: 16 },
  fieldCardHeaderRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14 },
  fieldName: { fontSize: 17, color: DARK_TEXT, fontWeight: "900" },
  fieldCrop: { fontSize: 13, color: "#666", fontWeight: "700", marginTop: 3 },
  priorityPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  priorityPillText: { fontSize: 11, fontWeight: "900" },
  fieldMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  fieldMetric: { width: "48%", backgroundColor: "#F7F8F4", borderRadius: 12, padding: 10 },
  fieldMetricLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldMetricLabel: { fontSize: 11, color: "#777", fontWeight: "700" },
  fieldMetricValue: { fontSize: 14, color: DARK_TEXT, fontWeight: "900", marginTop: 4 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  infoRowTop: { alignItems: "flex-start" },
  infoLabel: { fontSize: 13, color: "#666", marginRight: 12, flex: 0.42 },
  infoValue: { fontSize: 14, fontWeight: "700", color: DARK_TEXT, flex: 0.58, textAlign: "right" },
  notesValue: { textAlign: "left" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 8 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, marginHorizontal: 4, marginBottom: 8 },
  statusChipText: { color: "#FFF", fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  optimizerPendingBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: GREEN_LIGHT, borderRadius: 12, padding: 12, marginTop: 8 },
  optimizerPendingText: { fontSize: 13, color: "#47634A", fontWeight: "700" },
  tabBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingTop: 12, paddingHorizontal: 8, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#EEE" },
  tabItem: { alignItems: "center", flex: 1 },
  tabIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  tabIconWrapActive: { backgroundColor: GREEN_LIGHT },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 10, color: "#666" },
  tabLabelActive: { color: GREEN, fontWeight: "700" },
});