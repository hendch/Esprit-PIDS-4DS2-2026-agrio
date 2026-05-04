import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  GestureResponderEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
  Region,
} from "react-native-maps";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as Location from "expo-location";

import { useTheme } from "../../core/theme/useTheme";
import {
  FieldBoundaryRecord,
  listFieldBoundaries,
  saveFieldBoundary,
} from "./fieldBoundaryService";
import {
  SUPPORTED_CROPS,
  normalizeCropName,
  normalizeGovernorateName,
} from "./fieldVocabulary";

type LatLng = {
  latitude: number;
  longitude: number;
};

const INITIAL_REGION: Region = {
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

const IRRIGATION_METHODS = [
  "Drip",
  "Sprinkler",
  "Surface",
  "Pivot",
  "Rainfed / None",
];

const TAP_MAX_DISTANCE_PX = 12;
const TAP_MAX_DURATION_MS = 260;

function computeAreaHa(points: LatLng[]): number {
  if (points.length < 3) return 0;

  const meanLatRad =
    points.reduce((sum, point) => sum + (point.latitude * Math.PI) / 180, 0) /
    points.length;

  const metersPerDegLat = 111_132;
  const metersPerDegLon = 111_320 * Math.cos(meanLatRad);

  const coords = points.map((point) => ({
    x: point.longitude * metersPerDegLon,
    y: point.latitude * metersPerDegLat,
  }));

  const closed = [...coords, coords[0]];

  let areaM2 = 0;
  for (let i = 0; i < coords.length; i += 1) {
    areaM2 += closed[i].x * closed[i + 1].y - closed[i + 1].x * closed[i].y;
  }

  return Math.abs(areaM2 / 2) / 10_000;
}

function computeCentroid(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;

  const latitude =
    points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const longitude =
    points.reduce((sum, point) => sum + point.longitude, 0) / points.length;

  return { latitude, longitude };
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

function formatDateForApi(date: Date | null): string | undefined {
  if (!date) return undefined;
  return date.toISOString().slice(0, 10);
}

function formatDateForDisplay(date: Date | null): string {
  if (!date) return "Select planting date";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type PickerItem = {
  label: string;
  value: string;
};

type PickerModalProps = {
  visible: boolean;
  title: string;
  options: PickerItem[] | string[];
  searchable?: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
};

function PickerModal({
  visible,
  title,
  options,
  searchable = false,
  onClose,
  onSelect,
}: PickerModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!visible) {
      setQuery("");
    }
  }, [visible]);

  const normalizedOptions = useMemo(() => {
    return options.map((item) =>
      typeof item === "string" ? { label: item, value: item } : item,
    );
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return normalizedOptions;

    const q = query.trim().toLowerCase();

    return normalizedOptions.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q),
    );
  }, [normalizedOptions, query, searchable]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {searchable ? (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search..."
              placeholderTextColor="#777"
              style={styles.modalSearchInput}
            />
          ) : null}

          <ScrollView style={styles.modalList}>
            {filteredOptions.map((item) => (
              <Pressable
                key={`${item.value}:${item.label}`}
                style={styles.modalOption}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
              >
                <Text style={styles.modalOptionText}>{item.label}</Text>
              </Pressable>
            ))}

            {filteredOptions.length === 0 ? (
              <Text style={styles.modalEmpty}>No results</Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function FieldBoundarySetupScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const mapRef = useRef<MapView | null>(null);
  const tapGestureRef = useRef<{ x: number; y: number; startedAt: number; moved: boolean } | null>(null);

  const [region, setRegion] = useState<Region>(INITIAL_REGION);

  const [fieldName, setFieldName] = useState("");
  const [cropType, setCropType] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [plantingDate, setPlantingDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [irrigated, setIrrigated] = useState(false);
  const [irrigationMethod, setIrrigationMethod] = useState("");
  const [fieldNotes, setFieldNotes] = useState("");

  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [irrigationModalVisible, setIrrigationModalVisible] = useState(false);

  const [mapType, setMapType] = useState<"standard" | "hybrid">("hybrid");
  const [points, setPoints] = useState<LatLng[]>([]);
  const [lockedFields, setLockedFields] = useState<FieldBoundaryRecord[]>([]);
  const [lockedFieldsError, setLockedFieldsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isResolvingGovernorate, setIsResolvingGovernorate] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);

  const areaHa = useMemo(() => computeAreaHa(points), [points]);
  const centroid = useMemo(() => computeCentroid(points), [points]);
  const savedAreaHa = useMemo(
    () => lockedFields.reduce((sum, field) => sum + (field.areaHa ?? computeAreaHa(field.points)), 0),
    [lockedFields],
  );
  const drawingLine = points.length > 1 ? points : [];

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermissionGranted(status === "granted");
      } catch (error) {
        console.error("Location permission request failed:", error);
        setLocationPermissionGranted(false);
      }
    })();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLockedFields() {
      try {
        setLockedFieldsError(null);
        const fields = await listFieldBoundaries();
        if (isMounted) {
          setLockedFields(fields.filter((field) => field.points.length >= 3));
        }
      } catch {
        if (isMounted) {
          setLockedFieldsError("Saved fields could not be loaded. Existing field areas are not available on the map.");
        }
      }
    }

    void loadLockedFields();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fillGovernorateFromCentroid() {
      if (!centroid || points.length < 3) return;

      try {
        setIsResolvingGovernorate(true);

        const results = await Location.reverseGeocodeAsync({
          latitude: centroid.latitude,
          longitude: centroid.longitude,
        });

        if (!isMounted) return;

        const first = results[0];
        if (first) {
          const guessedGovernorate =
            first.region || first.subregion || first.city || governorate;

          if (guessedGovernorate) {
            setGovernorate(normalizeGovernorateName(guessedGovernorate));
          }
        }
      } catch (error) {
        console.error("Reverse geocoding failed:", error);
      } finally {
        if (isMounted) {
          setIsResolvingGovernorate(false);
        }
      }
    }

    void fillGovernorateFromCentroid();

    return () => {
      isMounted = false;
    };
  }, [centroid, points.length, governorate]);

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

  const undoPoint = () => {
    setPoints((current) => current.slice(0, -1));
  };

  const clearPoints = () => {
    setPoints([]);
  };

  const moveMapTo = (
    latitude: number,
    longitude: number,
    latitudeDelta = 0.03,
    longitudeDelta = 0.03,
  ) => {
    const nextRegion: Region = {
      latitude,
      longitude,
      latitudeDelta,
      longitudeDelta,
    };

    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 700);
  };

  const zoomByFactor = (factor: number) => {
    const nextRegion: Region = {
      ...region,
      latitudeDelta: Math.max(0.002, Math.min(region.latitudeDelta * factor, 40)),
      longitudeDelta: Math.max(0.002, Math.min(region.longitudeDelta * factor, 40)),
    };

    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 250);
  };

  const handleUseCurrentLocation = async () => {
    try {
      if (!locationPermissionGranted) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === "granted";
        setLocationPermissionGranted(granted);

        if (!granted) {
          Alert.alert(
            "Location permission denied",
            "Please allow location access to use the current location button.",
          );
          return;
        }
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      moveMapTo(current.coords.latitude, current.coords.longitude, 0.02, 0.02);
    } catch (error) {
      console.error("Current location failed:", error);
      Alert.alert(
        "Location unavailable",
        "Could not get the current location. On the emulator, set a Tunisia location in Extended controls → Location first.",
      );
    }
  };

  const onChangeDate = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setPlantingDate(selectedDate);
    }
  };

  const onSave = async () => {
    if (!fieldName.trim()) {
      Alert.alert("Missing field name", "Please provide a field name before saving.");
      return;
    }

    if (!cropType.trim()) {
      Alert.alert("Missing crop type", "Please select a crop before saving.");
      return;
    }

    if (points.length < 3) {
      Alert.alert("Boundary too small", "Add at least 3 points to create a valid field boundary.");
      return;
    }

    if (irrigated && !irrigationMethod.trim()) {
      Alert.alert(
        "Missing irrigation method",
        "Please choose the irrigation method if this field is irrigated.",
      );
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
        cropType: normalizeCropName(cropType) || undefined,
        areaHa,
        points,
        governorate: normalizeGovernorateName(governorate) || undefined,
        plantingDate: formatDateForApi(plantingDate),
        irrigated,
        irrigationMethod:
          irrigated && irrigationMethod !== "Rainfed / None"
            ? irrigationMethod.trim()
            : undefined,
        fieldNotes: fieldNotes.trim() || undefined,
      });

      Alert.alert("Saved", "Field boundary and profile saved successfully.");
      nav.goBack();
    } catch (error) {
      console.error("Save failed:", error);
      Alert.alert("Save failed", "Could not save the field. Please check your network and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.headerBorder,
          },
        ]}
      >
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Draw Field Border</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={INITIAL_REGION}
          region={region}
          onRegionChangeComplete={setRegion}
          onTouchStart={onMapTouchStart}
          onTouchMove={onMapTouchMove}
          onTouchEnd={onMapTouchEnd}
          customMapStyle={mapType === "standard" ? mapStyle : undefined}
          mapType={mapType}
          showsCompass
          showsScale
          toolbarEnabled={false}
          showsUserLocation={Boolean(locationPermissionGranted)}
          showsMyLocationButton={false}
        >
          {lockedFields.map((field) => (
            <Polygon
              key={field.id}
              coordinates={field.points}
              strokeColor="#1B5E20"
              fillColor="rgba(46, 125, 50, 0.18)"
              strokeWidth={2}
            />
          ))}

          {drawingLine.length > 1 ? (
            <Polyline coordinates={drawingLine} strokeColor="#D45A2A" strokeWidth={3} />
          ) : null}

          {points.length >= 3 ? (
            <Polygon
              coordinates={points}
              strokeColor="#D45A2A"
              fillColor="rgba(212, 90, 42, 0.24)"
              strokeWidth={3}
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
            style={[styles.mapControlBtn, mapType === "hybrid" && styles.mapControlBtnActive]}
            onPress={() => setMapType((current) => (current === "hybrid" ? "standard" : "hybrid"))}
            accessibilityLabel="Change map view"
          >
            <Text style={[styles.mapControlText, mapType === "hybrid" && styles.mapControlTextActive]}>
              {mapType === "hybrid" ? "Sat" : "Map"}
            </Text>
          </Pressable>

          <Pressable style={styles.mapControlBtn} onPress={handleUseCurrentLocation}>
            <Text style={styles.mapControlText}>◎</Text>
          </Pressable>

          <Pressable style={styles.mapControlBtn} onPress={() => zoomByFactor(0.5)} accessibilityLabel="Zoom in">
            <Text style={styles.mapControlText}>＋</Text>
          </Pressable>

          <Pressable style={styles.mapControlBtn} onPress={() => zoomByFactor(2.0)} accessibilityLabel="Zoom out">
            <Text style={styles.mapControlText}>－</Text>
          </Pressable>

          <Pressable
            style={[styles.mapControlBtn, points.length === 0 && styles.disabledControl]}
            onPress={undoPoint}
            disabled={points.length === 0}
            accessibilityLabel="Undo last border point"
          >
            <Text style={styles.mapControlText}>↶</Text>
          </Pressable>

          <Pressable
            style={[styles.mapControlBtn, points.length === 0 && styles.disabledControl]}
            onPress={clearPoints}
            disabled={points.length === 0}
            accessibilityLabel="Clear border points"
          >
            <Text style={styles.mapControlText}>×</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <Text style={styles.helpText}>
          Tap once to place a border point. Press and drag the map to move around without adding points.
        </Text>

        {lockedFieldsError ? <Text style={styles.warningText}>{lockedFieldsError}</Text> : null}

        <View style={styles.statsRow}>
          <Text style={styles.stat}>Points: {points.length}</Text>
          <Text style={styles.stat}>Area: {areaHa.toFixed(2)} ha</Text>
          <Text style={styles.stat}>Saved: {savedAreaHa.toFixed(2)} ha</Text>
        </View>

        {centroid ? (
          <View style={styles.statsRow}>
            <Text style={styles.stat}>
              Centroid: {centroid.latitude.toFixed(4)}, {centroid.longitude.toFixed(4)}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Field Profile</Text>

        <TextInput
          value={fieldName}
          onChangeText={setFieldName}
          placeholder="Field name"
          style={styles.input}
          placeholderTextColor="#777"
        />

        <Pressable style={styles.selector} onPress={() => setCropModalVisible(true)}>
          <Text style={cropType ? styles.selectorValue : styles.selectorPlaceholder}>
            {SUPPORTED_CROPS.find((item) => item.value === cropType)?.label || cropType || "Select crop"}
          </Text>
          <Text style={styles.selectorChevron}>▾</Text>
        </Pressable>

        <Pressable style={styles.selector} onPress={() => setShowDatePicker(true)}>
          <Text style={plantingDate ? styles.selectorValue : styles.selectorPlaceholder}>
            {formatDateForDisplay(plantingDate)}
          </Text>
          <Text style={styles.selectorChevron}>📅</Text>
        </Pressable>

        {showDatePicker ? (
          <DateTimePicker
            value={plantingDate || new Date()}
            mode="date"
            display="default"
            onChange={onChangeDate}
          />
        ) : null}

        <TextInput
          value={governorate}
          onChangeText={(value) => setGovernorate(normalizeGovernorateName(value))}
          placeholder={isResolvingGovernorate ? "Detecting governorate..." : "Governorate"}
          style={styles.input}
          placeholderTextColor="#777"
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Irrigated</Text>
          <Switch
            value={irrigated}
            onValueChange={setIrrigated}
            trackColor={{ false: "#CCC", true: "#A5D6A7" }}
            thumbColor={irrigated ? "#2E7D32" : "#FFF"}
          />
        </View>

        {irrigated ? (
          <Pressable style={styles.selector} onPress={() => setIrrigationModalVisible(true)}>
            <Text style={irrigationMethod ? styles.selectorValue : styles.selectorPlaceholder}>
              {irrigationMethod || "Select irrigation method"}
            </Text>
            <Text style={styles.selectorChevron}>▾</Text>
          </Pressable>
        ) : null}

        <TextInput
          value={fieldNotes}
          onChangeText={setFieldNotes}
          placeholder="Field notes (optional)"
          style={[styles.input, styles.notesInput]}
          placeholderTextColor="#777"
          multiline
        />

        <Pressable
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={isSaving}
        >
          <Text style={styles.saveBtnText}>
            {isSaving ? "Saving..." : "Save Field Boundary"}
          </Text>
        </Pressable>
      </ScrollView>

      <PickerModal
        visible={cropModalVisible}
        title="Select Crop"
        options={SUPPORTED_CROPS}
        searchable
        onClose={() => setCropModalVisible(false)}
        onSelect={(value) => setCropType(value)}
      />

      <PickerModal
        visible={irrigationModalVisible}
        title="Select Irrigation Method"
        options={IRRIGATION_METHODS}
        onClose={() => setIrrigationModalVisible(false)}
        onSelect={(value) => setIrrigationMethod(value)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    backgroundColor: "#FAFAF8",
    zIndex: 20,
  },
  backBtn: { fontSize: 24, color: "#222" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C" },
  headerSpacer: { width: 18 },

  mapWrap: {
    position: "relative",
    flex: 1,
    minHeight: 320,
  },
  map: {
    width: "100%",
    height: "100%",
    minHeight: 320,
  },

  mapControls: {
    position: "absolute",
    right: 14,
    gap: 10,
  },
  mapControlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DDD",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  mapControlBtnActive: {
    backgroundColor: "#D45A2A",
    borderColor: "#D45A2A",
  },
  mapControlText: {
    fontSize: 18,
    color: "#2C2C2C",
    fontWeight: "700",
  },
  mapControlTextActive: {
    color: "#FFF",
  },
  disabledControl: {
    opacity: 0.45,
  },
  areaBadge: {
    position: "absolute",
    left: 14,
    backgroundColor: "rgba(20, 20, 20, 0.72)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  areaBadgeLabel: {
    color: "#EDEDED",
    fontSize: 12,
    fontWeight: "600",
  },
  areaBadgeValue: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  pointMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#D45A2A",
    borderWidth: 2,
    borderColor: "#1B1B1B",
    alignItems: "center",
    justifyContent: "center",
  },
  pointMarkerText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
  },

  panel: {
    maxHeight: 460,
    backgroundColor: "#FAFAF8",
  },
  panelContent: {
    padding: 16,
    paddingBottom: 32,
  },

  helpText: {
    color: "#4A4A4A",
    marginBottom: 12,
    lineHeight: 20,
  },
  warningText: {
    color: "#B45309",
    fontSize: 13,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  stat: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E1E1E",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#B6B6B6",
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  actionBtnText: {
    color: "#333",
    fontWeight: "600",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C2C2C",
    marginBottom: 12,
  },

  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D5D5D5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    color: "#222",
  },

  selector: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D5D5D5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorValue: {
    color: "#222",
    fontSize: 14,
  },
  selectorPlaceholder: {
    color: "#777",
    fontSize: 14,
  },
  selectorChevron: {
    fontSize: 14,
    color: "#666",
  },

  notesInput: {
    minHeight: 90,
    textAlignVertical: "top",
    paddingTop: 12,
  },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 6,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E1E1E",
  },

  saveBtn: {
    marginTop: 8,
    backgroundColor: "#2E7D32",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "75%",
    paddingBottom: 16,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
  },
  modalClose: {
    fontSize: 20,
    color: "#666",
  },
  modalSearchInput: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#222",
  },
  modalList: {
    paddingHorizontal: 16,
  },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalOptionText: {
    fontSize: 15,
    color: "#222",
  },
  modalEmpty: {
    fontSize: 14,
    color: "#777",
    paddingVertical: 14,
  },
});
