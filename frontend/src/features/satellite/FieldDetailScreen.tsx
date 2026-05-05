import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Routes } from "../../core/navigation/routes";
import { useTheme } from "../../core/theme/useTheme";
import { httpClient } from "../../core/api/httpClient";
import {
  FieldBoundaryRecord,
  FieldMoistureSensor,
  FieldTask,
  createFieldMoistureSensor,
  deleteFieldBoundary,
  deleteFieldMoistureSensor,
  getFieldBoundary,
  listFieldMoistureSensors,
  listFieldTasks,
  updateFieldTask,
} from "./fieldBoundaryService";
import {
  FertilizerRecommendation,
  getFertilizerRecommendation,
} from "./fertilizerRecommendationService";
import { cropValueToLabel } from "./fieldVocabulary";
import { useTutorialStore } from "../../core/tutorial/store";

const OFFSET_WHITE = "#FAFAF8";
const GREEN = "#4CAF50";
const GREEN_LIGHT = "#E8F5E9";
const ORANGE = "#FF9800";
const RED = "#E53935";

type RouteParams = {
  fieldId?: string;
};

type FieldWeatherContextResponse = {
  field_id: string;
  farm_id: string;
  field_name: string;
  governorate?: string | null;
  centroid_lat: number;
  centroid_lon: number;
  current: {
    temperature?: number | null;
    wind_speed?: number | null;
    weather_code?: number | null;
    time?: string | null;
  };
  forecast: Array<{
    date: string;
    t_max?: number | null;
    t_min?: number | null;
    precipitation_mm?: number | null;
    wind_speed?: number | null;
    humidity?: number | null;
    et0?: number | null;
  }>;
};

type FieldNdviResponse = {
  field_id: string;
  mean_ndvi: number;
  min_ndvi: number;
  max_ndvi: number;
  captured_at: string;
};

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

type SensorDraft = {
  name: string;
  depthCm: string;
  moisturePct: string;
  notes: string;
  latitude?: number;
  longitude?: number;
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

function fieldMapRegion(field: FieldBoundaryRecord): Region {
  if (field.points.length === 0) {
    return {
      latitude: field.centroidLat ?? 36.8065,
      longitude: field.centroidLon ?? 10.1815,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  const latitudes = field.points.map((point) => point.latitude);
  const longitudes = field.points.map((point) => point.longitude);
  const latitude = field.centroidLat ?? latitudes.reduce((sum, value) => sum + value, 0) / Math.max(latitudes.length, 1);
  const longitude = field.centroidLon ?? longitudes.reduce((sum, value) => sum + value, 0) / Math.max(longitudes.length, 1);
  const latitudeDelta = Math.max(Math.max(...latitudes) - Math.min(...latitudes), 0.005) * 2.2;
  const longitudeDelta = Math.max(Math.max(...longitudes) - Math.min(...longitudes), 0.005) * 2.2;

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  };
}

function weatherCodeLabel(code?: number | null): string {
  if (code == null) return "Unknown";
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storm";
  return "Variable";
}

function ndviInterpretation(meanNdvi?: number | null): string {
  if (meanNdvi == null) return "NDVI unavailable.";
  if (meanNdvi < 0.15) {
    return "Very low vegetation signal. This may indicate sparse crop cover, bare soil, or strongly uneven field conditions.";
  }
  if (meanNdvi < 0.3) {
    return "Low vegetation vigor overall. Parts of the field may still be establishing or underperforming.";
  }
  if (meanNdvi < 0.5) {
    return "Moderate vegetation vigor. The field shows active vegetation but may still be heterogeneous.";
  }
  if (meanNdvi < 0.7) {
    return "Good vegetation vigor overall. Crop cover appears relatively healthy.";
  }
  return "Very strong vegetation signal. The field contains highly vigorous vegetation.";
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

function priorityExplanation(priority?: string): string {
  switch (priority) {
    case "stable":
      return "The combined agronomic signals are relatively stable right now.";
    case "monitor-closely":
      return "The field shows moderate agronomic pressure and should be monitored more closely.";
    case "intervene-soon":
      return "The field shows high agronomic pressure and may require prompt intervention.";
    default:
      return "Priority unavailable.";
  }
}

function buildRecommendation(
  field: FieldBoundaryRecord,
  optimize?: FieldOptimizeResponse | null,
  weather?: FieldWeatherContextResponse | null,
  ndvi?: FieldNdviResponse | null,
  effectiveNdviMean?: number | null,
): string {
  if (!field) return "No field context available.";

  const crop = cropValueToLabel(field.cropType || optimize?.crop_type || optimize?.context.crop);
  const notes = field.fieldNotes?.trim();
  const forecast = weather?.forecast ?? [];

  let message = "";

  if (optimize) {
    message = `The optimizer classifies ${crop} with ${optimize.yield_class} yield potential, ${optimize.stress_class} stress, and ${optimize.vigor_class} vegetation vigor. Current priority is ${optimize.optimization_priority.replace("-", " ")}.`;
  }

  if (effectiveNdviMean != null && effectiveNdviMean < 0.2) {
    message += " Parcel NDVI is low overall, which suggests sparse vegetation or uneven development across the field.";
  }

  if (forecast.length > 0) {
    const totalRain = forecast.reduce((sum, day) => sum + (day.precipitation_mm ?? 0), 0);
    const avgEt0 =
      forecast.length > 0
        ? forecast.reduce((sum, day) => sum + (day.et0 ?? 0), 0) / forecast.length
        : 0;

    if (totalRain < 2 && avgEt0 >= 4) {
      message += field.irrigated
        ? " Weather conditions look dry with relatively high evaporative demand, so irrigation should be monitored closely."
        : " Weather conditions look dry with relatively high evaporative demand, so water stress risk may rise on this non-irrigated field.";
    } else if (totalRain >= 3) {
      message += " Some rainfall is expected in the coming days, which may temporarily reduce water pressure.";
    }
  }

  if (notes) {
    message += ` Field note: ${notes}.`;
  }

  return message.trim() || "No recommendation available yet.";
}

async function getFieldWeatherContext(fieldId: string): Promise<FieldWeatherContextResponse> {
  const { data } = await httpClient.get<FieldWeatherContextResponse>(
    `/api/v1/fields/${fieldId}/weather-context`,
  );
  return data;
}

async function getFieldNdvi(fieldId: string): Promise<FieldNdviResponse> {
  const { data } = await httpClient.get<FieldNdviResponse>(
    `/api/v1/satellite/ndvi/${fieldId}`,
  );
  return data;
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

export function FieldDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const sensorPickerMapRef = useRef<MapView | null>(null);

  const tutorial = useTutorialStore();
  const showFieldGotIt = tutorial.currentStep?.key === 'view_field' && tutorial.isVisible;

  const params = route.params as RouteParams | undefined;
  const fieldId = params?.fieldId;
  const imageHeight = width * 0.42;

  const [field, setField] = useState<FieldBoundaryRecord | null>(null);
  const [weather, setWeather] = useState<FieldWeatherContextResponse | null>(null);
  const [ndvi, setNdvi] = useState<FieldNdviResponse | null>(null);
  const [optimize, setOptimize] = useState<FieldOptimizeResponse | null>(null);
  const [fertilizer, setFertilizer] = useState<FertilizerRecommendation | null>(null);
  const [sensors, setSensors] = useState<FieldMoistureSensor[]>([]);
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [sensorDraft, setSensorDraft] = useState<SensorDraft>({
    name: "",
    depthCm: "20",
    moisturePct: "45",
    notes: "",
  });
  const [sensorModalVisible, setSensorModalVisible] = useState(false);

  const [isLoadingField, setIsLoadingField] = useState(true);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isLoadingNdvi, setIsLoadingNdvi] = useState(false);
  const [isLoadingOptimize, setIsLoadingOptimize] = useState(false);
  const [isLoadingFertilizer, setIsLoadingFertilizer] = useState(false);
  const [isLoadingSensors, setIsLoadingSensors] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isSavingSensor, setIsSavingSensor] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [ndviError, setNdviError] = useState<string | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [fertilizerError, setFertilizerError] = useState<string | null>(null);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFieldAndIntelligence() {
      if (!fieldId) {
        setLoadError("Field not found.");
        setIsLoadingField(false);
        return;
      }

      try {
        setIsLoadingField(true);
        setLoadError(null);

        const fieldRecord = await getFieldBoundary(fieldId);
        if (!isMounted) return;

        setField(fieldRecord);
        setIsLoadingField(false);

        setIsLoadingOptimize(true);
        setOptimizeError(null);
        optimizeField(fieldId, {
          year: new Date().getFullYear(),
          governorate: fieldRecord.governorate || undefined,
          irrigated: fieldRecord.irrigated,
        })
          .then((data) => {
            if (isMounted) setOptimize(data);
          })
          .catch((error) => {
            console.error("Optimize failed:", error);
            if (isMounted) setOptimizeError("Optimizer output unavailable.");
          })
          .finally(() => {
            if (isMounted) setIsLoadingOptimize(false);
          });

        setIsLoadingWeather(true);
        setWeatherError(null);
        getFieldWeatherContext(fieldId)
          .then((data) => {
            if (isMounted) setWeather(data);
          })
          .catch((error) => {
            console.error("Weather context failed:", error);
            if (isMounted) setWeatherError("Weather context unavailable.");
          })
          .finally(() => {
            if (isMounted) setIsLoadingWeather(false);
          });

        setIsLoadingNdvi(true);
        setNdviError(null);
        getFieldNdvi(fieldId)
          .then((data) => {
            if (isMounted) setNdvi(data);
          })
          .catch((error) => {
            console.warn("NDVI detail unavailable:", error);
            if (isMounted) {
              setNdviError("Detailed NDVI unavailable. Using optimizer NDVI when possible.");
            }
          })
          .finally(() => {
            if (isMounted) setIsLoadingNdvi(false);
          });

        setIsLoadingFertilizer(true);
        setFertilizerError(null);
        getFertilizerRecommendation(fieldId)
          .then((data) => {
            if (isMounted) setFertilizer(data);
          })
          .catch((error) => {
            console.error("Fertilizer recommendation failed:", error);
            if (isMounted) setFertilizerError("Fertilizer recommendation unavailable.");
          })
          .finally(() => {
            if (isMounted) setIsLoadingFertilizer(false);
          });

        setIsLoadingSensors(true);
        setSensorError(null);
        listFieldMoistureSensors(fieldId)
          .then((data) => {
            if (isMounted) setSensors(data);
          })
          .catch((error) => {
            console.error("Moisture sensors failed:", error);
            if (isMounted) setSensorError("Moisture sensors unavailable.");
          })
          .finally(() => {
            if (isMounted) setIsLoadingSensors(false);
          });

        setIsLoadingTasks(true);
        setTaskError(null);
        listFieldTasks(fieldId)
          .then((data) => {
            if (isMounted) setTasks(data);
          })
          .catch((error) => {
            console.error("Field tasks failed:", error);
            if (isMounted) setTaskError("Field tasks unavailable.");
          })
          .finally(() => {
            if (isMounted) setIsLoadingTasks(false);
          });
      } catch (error) {
        console.error("Load field failed:", error);
        if (isMounted) {
          setLoadError("Could not load this field.");
          setIsLoadingField(false);
        }
      }
    }

    void loadFieldAndIntelligence();

    return () => {
      isMounted = false;
    };
  }, [fieldId]);

  const formattedYield = useMemo(() => {
    if (!optimize || !field) return null;
    return formatYield(optimize.yield_hg_per_ha, field.areaHa);
  }, [optimize, field]);

  const effectiveNdviMean = ndvi?.mean_ndvi ?? optimize?.context.ndvi_mean ?? null;

  const recommendation = useMemo(() => {
    if (!field) return null;
    return buildRecommendation(field, optimize, weather, ndvi, effectiveNdviMean);
  }, [field, optimize, weather, ndvi, effectiveNdviMean]);

  const mapRegion = useMemo(() => (field ? fieldMapRegion(field) : null), [field]);

  const onOpenSensorModal = () => {
    if (!field) {
      return;
    }
    setSensorDraft({
      name: "",
      depthCm: "20",
      moisturePct: "45",
      notes: "",
      latitude: field.centroidLat ?? field.points[0]?.latitude,
      longitude: field.centroidLon ?? field.points[0]?.longitude,
    });
    setSensorModalVisible(true);
  };

  const onSensorMapTouchEnd = async (event: GestureResponderEvent) => {
    try {
      const coordinate = await sensorPickerMapRef.current?.coordinateForPoint({
        x: event.nativeEvent.locationX,
        y: event.nativeEvent.locationY,
      });
      if (coordinate) {
        setSensorDraft((current) => ({
          ...current,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        }));
      }
    } catch (error) {
      console.warn("Sensor map tap failed:", error);
      Alert.alert("Map tap failed", "Could not place the sensor here. Try tapping again.");
    }
  };

  const onSaveSensor = async () => {
    if (!fieldId) {
      return;
    }
    if (!sensorDraft.name.trim()) {
      Alert.alert("Missing sensor name", "Please enter a name for this moisture sensor.");
      return;
    }
    if (sensorDraft.latitude == null || sensorDraft.longitude == null) {
      Alert.alert("Missing sensor location", "Tap the field map to place this sensor.");
      return;
    }

    const moisture = Number(sensorDraft.moisturePct);
    const depth = sensorDraft.depthCm.trim() ? Number(sensorDraft.depthCm) : undefined;
    if (!Number.isFinite(moisture) || moisture < 0 || moisture > 100) {
      Alert.alert("Invalid moisture", "Moisture must be between 0 and 100.");
      return;
    }

    try {
      setIsSavingSensor(true);
      const created = await createFieldMoistureSensor(fieldId, {
        name: sensorDraft.name.trim(),
        latitude: sensorDraft.latitude,
        longitude: sensorDraft.longitude,
        depthCm: Number.isFinite(depth) ? depth : undefined,
        simulatedMoisturePct: moisture,
        notes: sensorDraft.notes.trim() || undefined,
      });
      setSensors((current) => [created, ...current]);
      setSensorModalVisible(false);
    } catch (error) {
      console.error("Create sensor failed:", error);
      Alert.alert("Save failed", "Could not save this moisture sensor.");
    } finally {
      setIsSavingSensor(false);
    }
  };

  const onDeleteSensor = async (sensor: FieldMoistureSensor) => {
    if (!fieldId) {
      return;
    }
    try {
      await deleteFieldMoistureSensor(fieldId, sensor.id);
      setSensors((current) => current.filter((item) => item.id !== sensor.id));
    } catch (error) {
      console.error("Delete sensor failed:", error);
      Alert.alert("Delete failed", "Could not delete this moisture sensor.");
    }
  };

  const onToggleTask = async (task: FieldTask) => {
    if (!fieldId) {
      return;
    }
    const nextCompleted = !task.completed;
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, completed: nextCompleted } : item)),
    );

    try {
      const updated = await updateFieldTask(fieldId, task.id, nextCompleted);
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
    } catch (error) {
      console.error("Update task failed:", error);
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, completed: task.completed } : item)),
      );
      Alert.alert("Task update failed", "Could not update this task.");
    }
  };

  const onUpdateField = () => {
    if (!fieldId) {
      return;
    }
    nav.navigate(Routes.FieldBoundarySetup, { fieldId });
  };

  const onDeleteField = () => {
    if (!fieldId || !field) {
      return;
    }

    Alert.alert(
      "Delete field",
      `Delete ${field.name}? This removes the saved boundary and field profile.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteFieldBoundary(fieldId);
              nav.goBack();
            } catch (error) {
              console.error("Delete field failed:", error);
              Alert.alert("Delete failed", "Could not delete this field. Please try again.");
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

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
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>Agrio</Text>
        </View>

        <Text style={styles.headerRight}>Field</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoadingField ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={styles.stateText}>Loading field...</Text>
          </View>
        ) : null}

        {!isLoadingField && loadError ? <Text style={styles.stateText}>{loadError}</Text> : null}

        {!isLoadingField && !loadError && field ? (
          <>
            <View style={[styles.fieldHero, { height: imageHeight }]}> 
              <View style={styles.fieldHeroTop}>
                <View style={styles.tagGreen}>
                  <Text style={styles.tagText}>{field.name}</Text>
                </View>
                <View style={styles.tagLight}>
                  <Text style={styles.tagLightText}>
                    {cropValueToLabel(field.cropType || optimize?.crop_type || optimize?.context.crop)}
                  </Text>
                </View>
              </View>

              <View style={styles.fieldHeroBottom}>
                <View style={styles.tagOutline}>
                  <Text style={styles.tagOutlineText}>
                    {field.areaHa != null ? `${field.areaHa.toFixed(2)} ha` : "Area unavailable"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.fieldActionsRow}>
              <Pressable style={styles.updateFieldBtn} onPress={onUpdateField}>
                <Text style={styles.updateFieldBtnText}>Update Field</Text>
              </Pressable>

              <Pressable
                style={[styles.deleteFieldBtn, isDeleting && styles.actionBtnDisabled]}
                onPress={onDeleteField}
                disabled={isDeleting}
              >
                <Text style={styles.deleteFieldBtnText}>
                  {isDeleting ? "Deleting..." : "Delete Field"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Field Overview</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Crop</Text>
                <Text style={styles.infoValue}>
                  {cropValueToLabel(field.cropType || optimize?.crop_type || optimize?.context.crop)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Area</Text>
                <Text style={styles.infoValue}>
                  {field.areaHa != null ? `${field.areaHa.toFixed(2)} ha` : "Not set"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Governorate</Text>
                <Text style={styles.infoValue}>{field.governorate || optimize?.context.governorate || "Not set"}</Text>
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

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Centroid</Text>
                <Text style={styles.infoValue}>
                  {field.centroidLat != null && field.centroidLon != null
                    ? `${field.centroidLat.toFixed(4)}, ${field.centroidLon.toFixed(4)}`
                    : "Not set"}
                </Text>
              </View>

              {field.fieldNotes ? (
                <View style={[styles.infoRow, styles.infoRowTop]}>
                  <Text style={styles.infoLabel}>Notes</Text>
                  <Text style={[styles.infoValue, styles.notesValue]}>{field.fieldNotes}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Moisture Sensors</Text>
                <Pressable style={styles.smallActionBtn} onPress={onOpenSensorModal}>
                  <Text style={styles.smallActionBtnText}>Add Sensor</Text>
                </Pressable>
              </View>

              {mapRegion ? (
                <View style={styles.sensorMapWrap}>
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.sensorMap}
                    initialRegion={mapRegion}
                    mapType="hybrid"
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                  >
                    {field.points.length >= 3 ? (
                      <Polygon
                        coordinates={field.points}
                        strokeColor="#2E7D32"
                        fillColor="rgba(46, 125, 50, 0.22)"
                        strokeWidth={2}
                      />
                    ) : null}

                    {sensors.map((sensor) => (
                      <Marker
                        key={sensor.id}
                        coordinate={{ latitude: sensor.latitude, longitude: sensor.longitude }}
                      />
                    ))}
                  </MapView>
                </View>
              ) : null}

              {isLoadingSensors ? <Text style={styles.inlineStateText}>Loading sensors...</Text> : null}
              {sensorError ? <Text style={styles.inlineErrorText}>{sensorError}</Text> : null}

              {!isLoadingSensors && sensors.length === 0 ? (
                <Text style={styles.inlineStateText}>
                  No simulated moisture sensors yet. Add one and place it inside the field.
                </Text>
              ) : null}

              {sensors.map((sensor) => (
                <View key={sensor.id} style={styles.sensorRow}>
                  <View style={styles.sensorInfo}>
                    <Text style={styles.sensorName}>{sensor.name}</Text>
                    <Text style={styles.sensorMeta}>
                      Moisture {sensor.simulatedMoisturePct.toFixed(1)}%
                      {sensor.depthCm != null ? ` · ${sensor.depthCm.toFixed(0)} cm depth` : ""}
                    </Text>
                    <Text style={styles.sensorMeta}>
                      {sensor.latitude.toFixed(5)}, {sensor.longitude.toFixed(5)}
                    </Text>
                    {sensor.notes ? <Text style={styles.sensorMeta}>{sensor.notes}</Text> : null}
                  </View>
                  <Pressable style={styles.sensorDeleteBtn} onPress={() => onDeleteSensor(sensor)}>
                    <Text style={styles.sensorDeleteText}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Field Tasks</Text>

              {isLoadingTasks ? <Text style={styles.inlineStateText}>Loading tasks...</Text> : null}
              {taskError ? <Text style={styles.inlineErrorText}>{taskError}</Text> : null}

              {tasks.map((task) => (
                <Pressable key={task.id} style={styles.taskRow} onPress={() => onToggleTask(task)}>
                  <View style={[styles.taskCheckbox, task.completed && styles.taskCheckboxDone]}>
                    <Text style={styles.taskCheckboxText}>{task.completed ? "✓" : ""}</Text>
                  </View>
                  <View style={styles.taskContent}>
                    <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]}>
                      {task.title}
                    </Text>
                    {task.note ? <Text style={styles.taskNote}>{task.note}</Text> : null}
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Agronomic Optimizer</Text>

              {isLoadingOptimize ? (
                <Text style={styles.inlineStateText}>Running optimizer...</Text>
              ) : optimizeError ? (
                <Text style={styles.inlineErrorText}>{optimizeError}</Text>
              ) : optimize && formattedYield ? (
                <>
                  <Text style={styles.primaryMetric}>
                    {formattedYield.tonnesPerHa.toFixed(2)} t/ha
                  </Text>
                  <Text style={styles.secondaryMetric}>
                    {formattedYield.kgPerHa.toFixed(0)} kg/ha
                  </Text>

                  {formattedYield.totalTonnes != null ? (
                    <Text style={styles.secondaryMetric}>
                      Approx. total production: {formattedYield.totalTonnes.toFixed(2)} t
                    </Text>
                  ) : null}

                  <View style={styles.chipsWrap}>
                    <View style={[styles.statusChip, { backgroundColor: labelChipColor(optimize.yield_class) }]}> 
                      <Text style={styles.statusChipText}>Yield: {optimize.yield_class}</Text>
                    </View>

                    <View style={[styles.statusChip, { backgroundColor: labelChipColor(optimize.stress_class) }]}> 
                      <Text style={styles.statusChipText}>Stress: {optimize.stress_class}</Text>
                    </View>

                    <View style={[styles.statusChip, { backgroundColor: labelChipColor(optimize.vigor_class) }]}> 
                      <Text style={styles.statusChipText}>Vigor: {optimize.vigor_class}</Text>
                    </View>

                    <View style={[styles.statusChip, { backgroundColor: labelChipColor(optimize.optimization_priority) }]}> 
                      <Text style={styles.statusChipText}>
                        Priority: {optimize.optimization_priority.replace(/-/g, " ")}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.contextBlock}>
                    <Text style={styles.contextTitle}>Optimizer Context</Text>
                    <Text style={styles.contextLine}>
                      NDVI Mean: {optimize.context.ndvi_mean != null ? optimize.context.ndvi_mean.toFixed(3) : "—"}
                    </Text>
                    <Text style={styles.contextLine}>
                      Temp Mean: {optimize.context.temp_mean != null ? `${optimize.context.temp_mean.toFixed(2)}°C` : "—"}
                    </Text>
                    <Text style={styles.contextLine}>
                      Temp Range: {optimize.context.temp_min != null && optimize.context.temp_max != null
                        ? `${optimize.context.temp_min.toFixed(1)}°C → ${optimize.context.temp_max.toFixed(1)}°C`
                        : "—"}
                    </Text>
                    <Text style={styles.contextLine}>
                      Rain Sum: {optimize.context.rain_sum != null ? `${optimize.context.rain_sum.toFixed(2)} mm` : "—"}
                    </Text>
                    <Text style={styles.contextLine}>
                      Temp Stress: {optimize.context.temp_stress != null ? optimize.context.temp_stress.toFixed(2) : "—"}
                    </Text>
                  </View>

                  <Text style={styles.technicalValue}>
                    Technical value: {optimize.yield_hg_per_ha.toFixed(2)} hg/ha
                  </Text>
                  <Text style={styles.priorityExplanation}>
                    {priorityExplanation(optimize.optimization_priority)}
                  </Text>
                </>
              ) : (
                <Text style={styles.inlineStateText}>No optimizer output available.</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Vegetation Context (NDVI)</Text>

              {isLoadingNdvi ? (
                <Text style={styles.inlineStateText}>Loading NDVI...</Text>
              ) : ndvi ? (
                <>
                  <Text style={styles.primaryMetric}>{ndvi.mean_ndvi.toFixed(3)}</Text>
                  <Text style={styles.secondaryMetric}>
                    Observation date: {formatDate(ndvi.captured_at)}
                  </Text>

                  <View style={styles.contextBlock}>
                    <Text style={styles.contextTitle}>NDVI Summary</Text>
                    <Text style={styles.contextLine}>Mean NDVI: {ndvi.mean_ndvi.toFixed(3)}</Text>
                    <Text style={styles.contextLine}>Min NDVI: {ndvi.min_ndvi.toFixed(3)}</Text>
                    <Text style={styles.contextLine}>Max NDVI: {ndvi.max_ndvi.toFixed(3)}</Text>
                  </View>

                  <Text style={styles.ndviInterpretation}>
                    {ndviInterpretation(ndvi.mean_ndvi)}
                  </Text>
                </>
              ) : effectiveNdviMean != null ? (
                <>
                  <Text style={styles.primaryMetric}>{effectiveNdviMean.toFixed(3)}</Text>
                  <Text style={styles.secondaryMetric}>Using optimizer NDVI context</Text>

                  <View style={styles.contextBlock}>
                    <Text style={styles.contextTitle}>NDVI Summary</Text>
                    <Text style={styles.contextLine}>
                      Mean NDVI: {effectiveNdviMean.toFixed(3)}
                    </Text>
                    <Text style={styles.contextLine}>Detailed min/max unavailable right now.</Text>
                  </View>

                  <Text style={styles.ndviInterpretation}>
                    {ndviInterpretation(effectiveNdviMean)}
                  </Text>
                </>
              ) : (
                <Text style={styles.inlineStateText}>NDVI currently unavailable.</Text>
              )}

              {ndviError ? <Text style={styles.inlineErrorText}>{ndviError}</Text> : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Fertilizer Recommendation</Text>

              {isLoadingFertilizer ? (
                <Text style={styles.inlineStateText}>Checking fertilizer...</Text>
              ) : fertilizer ? (
                <>
                  <Text style={styles.primaryMetric}>{fertilizer.formula}</Text>
                  <Text style={styles.secondaryMetric}>
                    {fertilizer.fertilizer_kg_per_ha.toFixed(1)} kg/ha
                  </Text>
                  <Text style={styles.secondaryMetric}>
                    Total for field: {fertilizer.total_fertilizer_kg.toFixed(1)} kg
                  </Text>
                  <Text style={styles.secondaryMetric}>
                    Crop profile: {fertilizer.crop_group.replace(/_/g, " ")}
                  </Text>

                  <View style={styles.contextBlock}>
                    <Text style={styles.contextTitle}>Nutrient Need</Text>
                    <Text style={styles.contextLine}>
                      N: {fertilizer.nutrient_need_kg_ha.N?.toFixed(1) ?? "—"} kg/ha
                    </Text>
                    <Text style={styles.contextLine}>
                      P: {fertilizer.nutrient_need_kg_ha.P?.toFixed(1) ?? "—"} kg/ha
                    </Text>
                    <Text style={styles.contextLine}>
                      K: {fertilizer.nutrient_need_kg_ha.K?.toFixed(1) ?? "—"} kg/ha
                    </Text>
                  </View>

                  <Text style={styles.priorityExplanation}>{fertilizer.explanation}</Text>
                </>
              ) : (
                <Text style={styles.inlineStateText}>No fertilizer recommendation available.</Text>
              )}

              {fertilizerError ? <Text style={styles.inlineErrorText}>{fertilizerError}</Text> : null}

              {showFieldGotIt && (
                <Pressable
                  onPress={() => tutorial.checkAndAdvance('view_field')}
                  style={{ marginTop: 12, backgroundColor: '#2E7D32', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>✓ Got it — I've seen the field details</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weather Context</Text>

              {isLoadingWeather ? (
                <Text style={styles.inlineStateText}>Loading weather context...</Text>
              ) : weatherError ? (
                <Text style={styles.inlineErrorText}>{weatherError}</Text>
              ) : weather ? (
                <>
                  <View style={styles.weatherCurrentRow}>
                    <View style={styles.weatherChip}>
                      <Text style={styles.weatherChipLabel}>Now</Text>
                      <Text style={styles.weatherChipValue}>
                        {weather.current.temperature != null
                          ? `${weather.current.temperature}°C`
                          : "—"}
                      </Text>
                    </View>

                    <View style={styles.weatherChip}>
                      <Text style={styles.weatherChipLabel}>Wind</Text>
                      <Text style={styles.weatherChipValue}>
                        {weather.current.wind_speed != null
                          ? `${weather.current.wind_speed} km/h`
                          : "—"}
                      </Text>
                    </View>

                    <View style={styles.weatherChip}>
                      <Text style={styles.weatherChipLabel}>Sky</Text>
                      <Text style={styles.weatherChipValue}>
                        {weatherCodeLabel(weather.current.weather_code)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.subSectionTitle}>5-Day Forecast</Text>

                  {weather.forecast.map((day) => (
                    <View key={day.date} style={styles.forecastRow}>
                      <View style={styles.forecastDateWrap}>
                        <Text style={styles.forecastDate}>{formatDate(day.date)}</Text>
                      </View>
                      <View style={styles.forecastStats}>
                        <Text style={styles.forecastStat}>Max {day.t_max ?? "—"}°</Text>
                        <Text style={styles.forecastStat}>Min {day.t_min ?? "—"}°</Text>
                        <Text style={styles.forecastStat}>Rain {day.precipitation_mm ?? "—"} mm</Text>
                        <Text style={styles.forecastStat}>Humidity {day.humidity ?? "—"}%</Text>
                        <Text style={styles.forecastStat}>ET₀ {day.et0 ?? "—"}</Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.inlineStateText}>No weather context available.</Text>
              )}
            </View>

            <View style={[styles.card, styles.recommendationCard]}>
              <Text style={styles.cardTitle}>Recommendation</Text>
              <Text style={styles.recommendationText}>
                {recommendation || "No recommendation available yet."}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={sensorModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSensorModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sensorModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Moisture Sensor</Text>
              <TouchableOpacity onPress={() => setSensorModalVisible(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            {field && mapRegion ? (
              <View style={styles.sensorPickerMapWrap}>
                <MapView
                  ref={sensorPickerMapRef}
                  provider={PROVIDER_GOOGLE}
                  style={styles.sensorPickerMap}
                  initialRegion={mapRegion}
                  mapType="hybrid"
                  onTouchEnd={onSensorMapTouchEnd}
                  toolbarEnabled={false}
                >
                  {field.points.length >= 3 ? (
                    <Polygon
                      coordinates={field.points}
                      strokeColor="#2E7D32"
                      fillColor="rgba(46, 125, 50, 0.18)"
                      strokeWidth={2}
                    />
                  ) : null}

                  {sensorDraft.latitude != null && sensorDraft.longitude != null ? (
                    <Marker
                      coordinate={{
                        latitude: sensorDraft.latitude,
                        longitude: sensorDraft.longitude,
                      }}
                    />
                  ) : null}
                </MapView>
              </View>
            ) : null}

            <Text style={styles.modalHint}>Tap the map to place the simulated sensor.</Text>

            <TextInput
              value={sensorDraft.name}
              onChangeText={(value) => setSensorDraft((current) => ({ ...current, name: value }))}
              placeholder="Sensor name"
              placeholderTextColor="#777"
              style={styles.modalInput}
            />

            <View style={styles.modalInputRow}>
              <TextInput
                value={sensorDraft.depthCm}
                onChangeText={(value) => setSensorDraft((current) => ({ ...current, depthCm: value }))}
                placeholder="Depth cm"
                placeholderTextColor="#777"
                keyboardType="numeric"
                style={[styles.modalInput, styles.modalHalfInput]}
              />
              <TextInput
                value={sensorDraft.moisturePct}
                onChangeText={(value) => setSensorDraft((current) => ({ ...current, moisturePct: value }))}
                placeholder="Moisture %"
                placeholderTextColor="#777"
                keyboardType="numeric"
                style={[styles.modalInput, styles.modalHalfInput]}
              />
            </View>

            <TextInput
              value={sensorDraft.notes}
              onChangeText={(value) => setSensorDraft((current) => ({ ...current, notes: value }))}
              placeholder="Basic notes (optional)"
              placeholderTextColor="#777"
              style={[styles.modalInput, styles.modalNotesInput]}
              multiline
            />

            <Pressable
              style={[styles.saveSensorBtn, isSavingSensor && styles.actionBtnDisabled]}
              onPress={onSaveSensor}
              disabled={isSavingSensor}
            >
              <Text style={styles.saveSensorBtnText}>
                {isSavingSensor ? "Saving..." : "Save Sensor"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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

  loadingWrap: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    padding: 24,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  inlineStateText: {
    fontSize: 14,
    color: "#666",
  },
  inlineErrorText: {
    fontSize: 14,
    color: "#C62828",
    marginTop: 10,
  },

  fieldHero: {
    marginHorizontal: 24,
    marginTop: 20,
    borderRadius: 18,
    backgroundColor: "#A5D6A7",
    overflow: "hidden",
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

  tagGreen: {
    backgroundColor: "rgba(46, 125, 50, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  tagText: { color: "#FFF", fontWeight: "700", fontSize: 14 },

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
  fieldActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 24,
    marginTop: 14,
  },
  updateFieldBtn: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  updateFieldBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 14,
  },
  deleteFieldBtn: {
    flex: 1,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  deleteFieldBtnText: {
    color: RED,
    fontWeight: "800",
    fontSize: 14,
  },
  actionBtnDisabled: {
    opacity: 0.55,
  },

  card: {
    backgroundColor: "#FFF",
    marginHorizontal: 24,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2C2C2C",
    marginBottom: 14,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  smallActionBtn: {
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallActionBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
  },
  sensorMapWrap: {
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  sensorMap: {
    width: "100%",
    height: "100%",
  },
  sensorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  sensorInfo: {
    flex: 1,
  },
  sensorName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2C2C2C",
  },
  sensorMeta: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },
  sensorDeleteBtn: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sensorDeleteText: {
    color: RED,
    fontWeight: "800",
    fontSize: 12,
  },
  taskRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  taskCheckbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  taskCheckboxDone: {
    backgroundColor: GREEN,
  },
  taskCheckboxText: {
    color: "#FFF",
    fontWeight: "900",
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2C2C2C",
  },
  taskTitleDone: {
    color: "#777",
    textDecorationLine: "line-through",
  },
  taskNote: {
    marginTop: 3,
    fontSize: 12,
    color: "#666",
    lineHeight: 17,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  infoRowTop: {
    alignItems: "flex-start",
  },
  infoLabel: {
    fontSize: 13,
    color: "#666",
    marginRight: 12,
    flex: 0.45,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2C2C2C",
    flex: 0.55,
    textAlign: "right",
  },
  notesValue: {
    textAlign: "left",
  },

  primaryMetric: {
    fontSize: 30,
    fontWeight: "800",
    color: GREEN,
    marginBottom: 6,
  },
  secondaryMetric: {
    fontSize: 14,
    color: "#444",
    marginBottom: 4,
  },
  technicalValue: {
    fontSize: 11,
    color: "#777",
    marginTop: 12,
  },

  contextBlock: {
    marginTop: 14,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 12,
    padding: 14,
  },
  contextTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2C2C2C",
    marginBottom: 8,
  },
  contextLine: {
    fontSize: 13,
    color: "#444",
    marginBottom: 4,
  },

  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginTop: 10,
    marginBottom: 6,
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

  priorityExplanation: {
    fontSize: 13,
    color: "#555",
    marginTop: 10,
    lineHeight: 20,
  },

  ndviInterpretation: {
    fontSize: 14,
    color: "#444",
    lineHeight: 21,
    marginTop: 12,
  },

  weatherCurrentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  weatherChip: {
    flex: 1,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    marginHorizontal: 4,
  },
  weatherChipLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  weatherChipValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2C2C2C",
    textAlign: "center",
  },

  subSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2C2C2C",
    marginBottom: 12,
  },

  forecastRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 12,
    paddingBottom: 12,
  },
  forecastDateWrap: {
    width: 100,
    paddingRight: 12,
  },
  forecastDate: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2C2C2C",
  },
  forecastStats: {
    flex: 1,
  },
  forecastStat: {
    fontSize: 13,
    color: "#444",
    marginBottom: 4,
  },

  recommendationCard: {
    backgroundColor: GREEN_LIGHT,
  },
  recommendationText: {
    fontSize: 15,
    color: "#2C2C2C",
    lineHeight: 22,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sensorModalCard: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#222",
  },
  modalClose: {
    fontSize: 22,
    color: "#666",
  },
  sensorPickerMapWrap: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DDD",
  },
  sensorPickerMap: {
    width: "100%",
    height: "100%",
  },
  modalHint: {
    color: "#666",
    fontSize: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  modalInput: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D5D5D5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#222",
    marginBottom: 10,
  },
  modalInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalHalfInput: {
    flex: 1,
  },
  modalNotesInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  saveSensorBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 13,
  },
  saveSensorBtnText: {
    color: "#FFF",
    fontWeight: "800",
  },
});
