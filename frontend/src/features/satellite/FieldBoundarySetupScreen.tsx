import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  GestureResponderEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, {
  LatLng as MapLatLng,
  Marker,
  Polygon,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../core/theme/useTheme";
import {
  CROP_CATEGORY_OPTIONS,
  CROP_OPTIONS,
  FIELD_TYPE_OPTIONS,
  growthStageFromPlantingDate,
} from "./cropOptions";
import { FieldBoundaryRecord, listFieldBoundaries, saveFieldBoundary } from "./fieldBoundaryService";

type LatLng = {
  latitude: number;
  longitude: number;
};

const INITIAL_REGION = {
  latitude: 36.8065,
  longitude: 10.1815,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};

const mapStyle = [
  { elementType: "geometry", stylers: [{ color: "#EEF2E6" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#394235" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#F8FAF2" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#B9C4B0" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#DDEDD2" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#CAD4C0" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#B9DCEB" }] },
];

function computeAreaHa(points: LatLng[]): number {
  if (points.length < 3) {
    return 0;
  }

  const meanLatRad =
    points.reduce((sum, point) => sum + (point.latitude * Math.PI) / 180, 0) / points.length;
  const metersPerDegLat = 111_132;
  const metersPerDegLon = 111_320 * Math.cos(meanLatRad);
  const coords = points.map((point) => ({
    x: point.longitude * metersPerDegLon,
    y: point.latitude * metersPerDegLat,
  }));
  const closed = [...coords, coords[0]];

  let areaM2 = 0;
  for (let index = 0; index < coords.length; index += 1) {
    areaM2 += closed[index].x * closed[index + 1].y - closed[index + 1].x * closed[index].y;
  }
  return Math.abs(areaM2 / 2) / 10_000;
}

function isPointInsidePolygon(point: LatLng, polygon: LatLng[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crossesLatitude =
      currentPoint.latitude > point.latitude !== previousPoint.latitude > point.latitude;

    if (!crossesLatitude) {
      continue;
    }

    const intersectLongitude =
      ((previousPoint.longitude - currentPoint.longitude) * (point.latitude - currentPoint.latitude)) /
        (previousPoint.latitude - currentPoint.latitude) +
      currentPoint.longitude;

    if (point.longitude < intersectLongitude) {
      inside = !inside;
    }
  }

  return inside;
}

function orientation(a: LatLng, b: LatLng, c: LatLng): number {
  return (b.longitude - a.longitude) * (c.latitude - a.latitude) - (b.latitude - a.latitude) * (c.longitude - a.longitude);
}

function isOnSegment(a: LatLng, b: LatLng, c: LatLng): boolean {
  return (
    Math.min(a.longitude, b.longitude) <= c.longitude &&
    c.longitude <= Math.max(a.longitude, b.longitude) &&
    Math.min(a.latitude, b.latitude) <= c.latitude &&
    c.latitude <= Math.max(a.latitude, b.latitude)
  );
}

function doSegmentsIntersect(a: LatLng, b: LatLng, c: LatLng, d: LatLng): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  const epsilon = 0.000000001;

  if (Math.abs(o1) < epsilon && isOnSegment(a, b, c)) return true;
  if (Math.abs(o2) < epsilon && isOnSegment(a, b, d)) return true;
  if (Math.abs(o3) < epsilon && isOnSegment(c, d, a)) return true;
  if (Math.abs(o4) < epsilon && isOnSegment(c, d, b)) return true;

  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function polygonOverlaps(newPolygon: LatLng[], existingPolygon: LatLng[]): boolean {
  if (newPolygon.length < 3 || existingPolygon.length < 3) {
    return false;
  }

  if (newPolygon.some((point) => isPointInsidePolygon(point, existingPolygon))) {
    return true;
  }
  if (existingPolygon.some((point) => isPointInsidePolygon(point, newPolygon))) {
    return true;
  }

  for (let newIndex = 0; newIndex < newPolygon.length; newIndex += 1) {
    const newStart = newPolygon[newIndex];
    const newEnd = newPolygon[(newIndex + 1) % newPolygon.length];
    for (let existingIndex = 0; existingIndex < existingPolygon.length; existingIndex += 1) {
      const existingStart = existingPolygon[existingIndex];
      const existingEnd = existingPolygon[(existingIndex + 1) % existingPolygon.length];
      if (doSegmentsIntersect(newStart, newEnd, existingStart, existingEnd)) {
        return true;
      }
    }
  }

  return false;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TAP_MAX_DISTANCE_PX = 12;
const TAP_MAX_DURATION_MS = 260;

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatPlantingDate(year: number, month: number, day: number): string {
  return `${year}-${padDatePart(month + 1)}-${padDatePart(day)}`;
}

function normalizeDateParts(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
}

export function FieldBoundarySetupScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const mapRef = useRef<MapView | null>(null);
  const tapGestureRef = useRef<{ x: number; y: number; startedAt: number; moved: boolean } | null>(null);

  const [fieldName, setFieldName] = useState("");
  const [cropType, setCropType] = useState(CROP_OPTIONS[0].value);
  const [plantingYear, setPlantingYear] = useState(() => new Date().getFullYear());
  const [plantingMonth, setPlantingMonth] = useState(() => new Date().getMonth());
  const [plantingDay, setPlantingDay] = useState(() => new Date().getDate());
  const [fieldType, setFieldType] = useState(FIELD_TYPE_OPTIONS[0].value);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([CROP_CATEGORY_OPTIONS[0].value]);
  const [varietyInputs, setVarietyInputs] = useState([""]);
  const [mapType, setMapType] = useState<"standard" | "hybrid">("hybrid");
  const [points, setPoints] = useState<LatLng[]>([]);
  const [lockedFields, setLockedFields] = useState<FieldBoundaryRecord[]>([]);
  const [lockedFieldsError, setLockedFieldsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const areaHa = useMemo(() => computeAreaHa(points), [points]);
  const savedAreaHa = useMemo(
    () => lockedFields.reduce((sum, field) => sum + (field.areaHa ?? computeAreaHa(field.points)), 0),
    [lockedFields],
  );
  const plantingDate = useMemo(
    () => formatPlantingDate(plantingYear, plantingMonth, plantingDay),
    [plantingDay, plantingMonth, plantingYear],
  );
  const varieties = useMemo(
    () => varietyInputs.map((variety) => variety.trim()).filter(Boolean),
    [varietyInputs],
  );
  const growthStage = growthStageFromPlantingDate(plantingDate);
  const drawingLine = points.length > 1 ? points : [];

  const loadLockedFields = useCallback(async () => {
    try {
      setLockedFieldsError(null);
      const fields = await listFieldBoundaries();
      setLockedFields(fields.filter((field) => field.points.length >= 3));
    } catch {
      setLockedFieldsError("Saved fields could not be loaded. Existing field areas are not available on the map.");
    }
  }, []);

  useEffect(() => {
    void loadLockedFields();
  }, [loadLockedFields]);

  const addCoordinate = (coordinate: LatLng) => {
    const { latitude, longitude } = coordinate;
    const nextPoint = { latitude, longitude };
    const touchedLockedField = lockedFields.find((field) => isPointInsidePolygon(nextPoint, field.points));
    if (touchedLockedField) {
      Alert.alert(
        "Field already saved",
        `${touchedLockedField.name} is locked on the map. Delete that field before drawing in this area again.`,
      );
      return;
    }

    setPoints((current) => [...current, nextPoint]);
  };

  const onMapTouchStart = (event: GestureResponderEvent) => {
    tapGestureRef.current = {
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
      startedAt: Date.now(),
      moved: false,
    };
  };

  const onMapTouchMove = (event: GestureResponderEvent) => {
    const gesture = tapGestureRef.current;
    if (!gesture) {
      return;
    }

    const deltaX = event.nativeEvent.locationX - gesture.x;
    const deltaY = event.nativeEvent.locationY - gesture.y;
    if (Math.hypot(deltaX, deltaY) > TAP_MAX_DISTANCE_PX) {
      gesture.moved = true;
    }
  };

  const onMapTouchEnd = async (event: GestureResponderEvent) => {
    const gesture = tapGestureRef.current;
    tapGestureRef.current = null;
    if (!gesture || gesture.moved || Date.now() - gesture.startedAt > TAP_MAX_DURATION_MS) {
      return;
    }

    try {
      const coordinate = await mapRef.current?.coordinateForPoint({
        x: event.nativeEvent.locationX,
        y: event.nativeEvent.locationY,
      });
      if (coordinate) {
        addCoordinate(coordinate);
      }
    } catch {
      Alert.alert("Map tap failed", "Could not read this map position. Try tapping again after the map finishes moving.");
    }
  };

  const toggleCategory = (value: string) => {
    setSelectedCategories((current) =>
      current.includes(value) ? current.filter((category) => category !== value) : [...current, value],
    );
  };

  const adjustPlantingDate = (unit: "month" | "day" | "year", amount: number) => {
    const date = new Date(plantingYear, plantingMonth, plantingDay);
    if (unit === "month") {
      date.setMonth(date.getMonth() + amount);
    } else if (unit === "day") {
      date.setDate(date.getDate() + amount);
    } else {
      date.setFullYear(date.getFullYear() + amount);
    }
    const next = normalizeDateParts(date);
    setPlantingYear(next.year);
    setPlantingMonth(next.month);
    setPlantingDay(next.day);
  };

  const updateVariety = (index: number, value: string) => {
    setVarietyInputs((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  const addVariety = () => {
    setVarietyInputs((current) => [...current, ""]);
  };

  const removeVariety = (index: number) => {
    setVarietyInputs((current) => {
      if (current.length === 1) {
        return [""];
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const undoPoint = () => {
    setPoints((current) => current.slice(0, -1));
  };

  const clearPoints = () => {
    setPoints([]);
  };

  const onSave = async () => {
    if (!fieldName.trim()) {
      Alert.alert("Missing field name", "Please provide a field name before saving.");
      return;
    }
    if (points.length < 3) {
      Alert.alert("Boundary too small", "Add at least 3 points to create a valid field boundary.");
      return;
    }
    if (selectedCategories.length === 0) {
      Alert.alert("Crop category required", "Select at least one crop category.");
      return;
    }
    if (varieties.length === 0) {
      Alert.alert("Variety required", "Enter one variety, then use + if you want to add another one.");
      return;
    }

    const overlappingField = lockedFields.find((field) => polygonOverlaps(points, field.points));
    if (overlappingField) {
      Alert.alert(
        "Boundary overlaps a saved field",
        `${overlappingField.name} is already saved. Delete it before reusing that area.`,
      );
      return;
    }

    try {
      setIsSaving(true);
      await saveFieldBoundary({
        name: fieldName.trim(),
        cropType,
        plantingDate,
        fieldType,
        cropCategories: selectedCategories,
        varieties,
        areaHa,
        points,
      });
      Alert.alert("Saved", "Field boundary and crop details were saved successfully.");
      nav.goBack();
    } catch {
      Alert.alert("Save failed", "Could not save the boundary. Please check your network and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.headerBorder }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.headerIconBtn}>
          <Text style={styles.backBtn}>{"<"}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>New field</Text>
          <Text style={styles.headerSubtitle}>Draw field border</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={INITIAL_REGION}
          onTouchStart={onMapTouchStart}
          onTouchMove={onMapTouchMove}
          onTouchEnd={onMapTouchEnd}
          customMapStyle={mapType === "standard" ? mapStyle : undefined}
          mapType={mapType}
          showsCompass
          showsScale
          toolbarEnabled={false}
        >
          {lockedFields.map((field) => (
            <Polygon
              key={field.id}
              coordinates={field.points}
              strokeColor="#178A45"
              fillColor="rgba(23, 138, 69, 0.24)"
              strokeWidth={2}
              tappable={false}
            />
          ))}
          {drawingLine.length > 1 ? (
            <Polyline coordinates={drawingLine as MapLatLng[]} strokeColor="#D95B2B" strokeWidth={4} />
          ) : null}
          {points.length >= 3 ? (
            <Polygon
              coordinates={points}
              strokeColor="#D95B2B"
              fillColor="rgba(217, 91, 43, 0.22)"
              strokeWidth={4}
            />
          ) : null}
          {points.map((point, index) => (
            <Marker
              key={`${point.latitude}-${point.longitude}-${index.toString()}`}
              coordinate={point}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.pointMarker}>
                <Text style={styles.pointMarkerText}>{index + 1}</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        <View pointerEvents="none" style={[styles.areaBadge, { top: insets.top + 16 }]}>
          <Text style={styles.areaBadgeLabel}>Total area</Text>
          <Text style={styles.areaBadgeValue}>{areaHa.toFixed(2)} ha</Text>
        </View>

        <View pointerEvents="box-none" style={[styles.mapControls, { top: insets.top + 16 }]}>
          <Pressable
            style={[styles.roundControl, mapType === "hybrid" && styles.roundControlActive]}
            onPress={() => setMapType((current) => (current === "hybrid" ? "standard" : "hybrid"))}
            accessibilityLabel="Change map view"
          >
            <Text style={[styles.roundControlText, mapType === "hybrid" && styles.roundControlTextActive]}>
              {mapType === "hybrid" ? "Sat" : "Map"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.roundControl, points.length === 0 && styles.disabledBtn]}
            onPress={undoPoint}
            disabled={points.length === 0}
            accessibilityLabel="Undo last boundary point"
          >
            <Text style={styles.roundControlText}>{"↶"}</Text>
          </Pressable>
          <Pressable
            style={[styles.roundControl, points.length === 0 && styles.disabledBtn]}
            onPress={clearPoints}
            disabled={points.length === 0}
            accessibilityLabel="Clear boundary points"
          >
            <Text style={styles.roundControlText}>{"×"}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={[styles.panel, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.panelContent}
      >
        <View style={styles.statusRow}>
          <View style={[styles.statPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Points</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{points.length}</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Locked</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{savedAreaHa.toFixed(2)} ha</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Stage</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{growthStage}</Text>
          </View>
        </View>

        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          Tap once to place a border point. Press and drag the map to move around without adding points.
        </Text>
        {lockedFieldsError ? <Text style={styles.warningText}>{lockedFieldsError}</Text> : null}

        <TextInput
          value={fieldName}
          onChangeText={setFieldName}
          placeholder="Field name"
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.text }]}
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Planting date</Text>
        <View style={[styles.datePickerCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.datePickerHeader}>
            <Text style={[styles.datePickerValue, { color: colors.text }]}>{plantingDate}</Text>
            <Text style={[styles.datePickerStage, { color: colors.textSecondary }]}>{growthStage}</Text>
          </View>
          <View style={styles.datePickerRow}>
            <View style={styles.dateStepGroup}>
              <Text style={[styles.dateStepLabel, { color: colors.textSecondary }]}>Month</Text>
              <View style={styles.dateStepControl}>
                <Pressable style={styles.dateStepBtn} onPress={() => adjustPlantingDate("month", -1)}>
                  <Text style={styles.dateStepBtnText}>-</Text>
                </Pressable>
                <Text style={[styles.dateStepValue, { color: colors.text }]}>{MONTH_LABELS[plantingMonth]}</Text>
                <Pressable style={styles.dateStepBtn} onPress={() => adjustPlantingDate("month", 1)}>
                  <Text style={styles.dateStepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.dateStepGroup}>
              <Text style={[styles.dateStepLabel, { color: colors.textSecondary }]}>Day</Text>
              <View style={styles.dateStepControl}>
                <Pressable style={styles.dateStepBtn} onPress={() => adjustPlantingDate("day", -1)}>
                  <Text style={styles.dateStepBtnText}>-</Text>
                </Pressable>
                <Text style={[styles.dateStepValue, { color: colors.text }]}>{plantingDay}</Text>
                <Pressable style={styles.dateStepBtn} onPress={() => adjustPlantingDate("day", 1)}>
                  <Text style={styles.dateStepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.dateStepGroup}>
              <Text style={[styles.dateStepLabel, { color: colors.textSecondary }]}>Year</Text>
              <View style={styles.dateStepControl}>
                <Pressable style={styles.dateStepBtn} onPress={() => adjustPlantingDate("year", -1)}>
                  <Text style={styles.dateStepBtnText}>-</Text>
                </Pressable>
                <Text style={[styles.dateStepValue, { color: colors.text }]}>{plantingYear}</Text>
                <Pressable style={styles.dateStepBtn} onPress={() => adjustPlantingDate("year", 1)}>
                  <Text style={styles.dateStepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Field type</Text>
        <View style={styles.segmentRow}>
          {FIELD_TYPE_OPTIONS.map((option) => {
            const selected = option.value === fieldType;
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.segmentBtn,
                  { borderColor: colors.cardBorder, backgroundColor: colors.card },
                  selected && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                ]}
                onPress={() => setFieldType(option.value)}
              >
                <Text style={[styles.segmentText, { color: selected ? colors.primary : colors.text }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Crop category</Text>
        <View style={styles.chipGrid}>
          {CROP_CATEGORY_OPTIONS.map((option) => {
            const selected = selectedCategories.includes(option.value);
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.chip,
                  { borderColor: colors.cardBorder, backgroundColor: colors.card },
                  selected && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                ]}
                onPress={() => toggleCategory(option.value)}
              >
                <Text style={[styles.chipText, { color: selected ? colors.primary : colors.text }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Main crop</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropScroller}>
          {CROP_OPTIONS.map((crop) => {
            const selected = crop.value === cropType;
            return (
              <Pressable
                key={crop.value}
                style={[
                  styles.cropBtn,
                  { borderColor: colors.cardBorder, backgroundColor: colors.card },
                  selected && { backgroundColor: "#D95B2B", borderColor: "#D95B2B" },
                ]}
                onPress={() => setCropType(crop.value)}
              >
                <Text style={[styles.cropBtnText, { color: selected ? "#FFF" : colors.text }]}>{crop.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.varietyTitleRow}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Variety</Text>
          <Pressable style={[styles.addVarietyBtn, { backgroundColor: colors.primary }]} onPress={addVariety}>
            <Text style={styles.addVarietyText}>+</Text>
          </Pressable>
        </View>
        {varietyInputs.map((value, index) => (
          <View key={index.toString()} style={styles.varietyRow}>
            <TextInput
              value={value}
              onChangeText={(nextValue) => updateVariety(index, nextValue)}
              placeholder={index === 0 ? "Write variety name" : "Another variety"}
              style={[
                styles.input,
                styles.varietyInput,
                { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.text },
              ]}
              placeholderTextColor={colors.textSecondary}
            />
            <Pressable
              style={[
                styles.removeVarietyBtn,
                { borderColor: colors.cardBorder },
                varietyInputs.length === 1 && !value.trim() && styles.disabledBtn,
              ]}
              onPress={() => removeVariety(index)}
              disabled={varietyInputs.length === 1 && !value.trim()}
            >
              <Text style={[styles.removeVarietyText, { color: colors.textSecondary }]}>-</Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          style={[styles.saveBtn, { backgroundColor: colors.primary }, isSaving && styles.disabledBtn]}
          onPress={onSave}
          disabled={isSaving}
        >
          <Text style={styles.saveBtnText}>{isSaving ? "Saving..." : "Save Field Boundary"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    backgroundColor: "#FAFAF8",
    zIndex: 2,
  },
  headerIconBtn: { width: 44, height: 40, alignItems: "flex-start", justifyContent: "center" },
  backBtn: { fontSize: 28, color: "#222", fontWeight: "600" },
  headerCenter: { alignItems: "center", flex: 1 },
  headerTitle: { fontSize: 19, fontWeight: "700", color: "#1F241D" },
  headerSubtitle: { fontSize: 13, color: "#5E6758", marginTop: 2 },
  headerSpacer: { width: 44 },
  mapWrap: { flex: 1.15, minHeight: 360, position: "relative" },
  map: { ...StyleSheet.absoluteFillObject },
  areaBadge: {
    position: "absolute",
    left: 14,
    backgroundColor: "rgba(20, 24, 18, 0.82)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  areaBadgeLabel: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "600" },
  areaBadgeValue: { color: "#FFF", fontSize: 20, fontWeight: "800", marginTop: 2 },
  mapControls: { position: "absolute", right: 14, gap: 12 },
  roundControl: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  roundControlActive: { backgroundColor: "#D95B2B" },
  roundControlText: { color: "#525A4E", fontSize: 16, fontWeight: "800" },
  roundControlTextActive: { color: "#FFF" },
  pointMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#D95B2B",
    borderWidth: 3,
    borderColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  pointMarkerText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  panel: { maxHeight: 390, backgroundColor: "#FAFAF8", borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  panelContent: { padding: 16, paddingBottom: 28 },
  statusRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statLabel: { fontSize: 11, marginBottom: 3 },
  statValue: { fontSize: 13, fontWeight: "800" },
  helperText: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  warningText: { color: "#E53935", fontSize: 12, lineHeight: 18, marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8, marginTop: 2 },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D5D5D5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: "#222",
  },
  datePickerCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  datePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  datePickerValue: { fontSize: 16, fontWeight: "800" },
  datePickerStage: { fontSize: 12, fontWeight: "700" },
  datePickerRow: { flexDirection: "row", gap: 8 },
  dateStepGroup: { flex: 1 },
  dateStepLabel: { fontSize: 11, fontWeight: "700", marginBottom: 5 },
  dateStepControl: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#F7F7F4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  dateStepBtn: {
    width: 32,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2E6",
  },
  dateStepBtnText: { fontSize: 18, lineHeight: 20, color: "#2E7D32", fontWeight: "900" },
  dateStepValue: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "800" },
  segmentRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  segmentBtn: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  segmentText: { fontSize: 12, fontWeight: "800", textAlign: "center" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  cropScroller: { gap: 8, paddingBottom: 12 },
  cropBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cropBtnText: { fontSize: 13, fontWeight: "800" },
  varietyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  addVarietyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  addVarietyText: { color: "#FFF", fontSize: 22, lineHeight: 24, fontWeight: "800" },
  varietyRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  varietyInput: { flex: 1 },
  removeVarietyBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  removeVarietyText: { fontSize: 24, lineHeight: 26, fontWeight: "800" },
  disabledBtn: { opacity: 0.55 },
  saveBtn: {
    marginTop: 4,
    backgroundColor: "#2E7D32",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
});
