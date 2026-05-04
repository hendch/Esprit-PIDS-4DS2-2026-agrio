import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { MapPressEvent, Marker, Polygon, PROVIDER_GOOGLE } from "react-native-maps";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../core/theme/useTheme";
import { saveFieldBoundary } from "./fieldBoundaryService";

type LatLng = {
  latitude: number;
  longitude: number;
};

const INITIAL_REGION = {
  latitude: 36.8065,
  longitude: 10.1815,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

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

export function FieldBoundarySetupScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [fieldName, setFieldName] = useState("");
  const [cropType, setCropType] = useState("");
  const [points, setPoints] = useState<LatLng[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const areaHa = useMemo(() => computeAreaHa(points), [points]);

  const addPoint = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setPoints((current) => [...current, { latitude, longitude }]);
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

    try {
      setIsSaving(true);
      await saveFieldBoundary({
        name: fieldName.trim(),
        cropType: cropType.trim() || undefined,
        areaHa,
        points,
      });
      Alert.alert("Saved", "Field boundary saved successfully.");
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
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Draw Field Border</Text>
        <View style={styles.headerSpacer} />
      </View>

      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        onPress={addPoint}
      >
        {points.map((point, index) => (
          <Marker
            key={`${point.latitude}-${point.longitude}-${index.toString()}`}
            coordinate={point}
            title={`Point ${index + 1}`}
          />
        ))}
        {points.length >= 3 ? (
          <Polygon
            coordinates={points}
            strokeColor="#2E7D32"
            fillColor="rgba(46, 125, 50, 0.2)"
            strokeWidth={2}
          />
        ) : null}
      </MapView>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <Text style={styles.helpText}>
          Tap on the map to add boundary points in order, like Farmable polygon drawing.
        </Text>

        <View style={styles.statsRow}>
          <Text style={styles.stat}>Points: {points.length}</Text>
          <Text style={styles.stat}>Area: {areaHa.toFixed(2)} ha</Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={undoPoint} disabled={points.length === 0}>
            <Text style={styles.actionBtnText}>Undo</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={clearPoints} disabled={points.length === 0}>
            <Text style={styles.actionBtnText}>Clear</Text>
          </Pressable>
        </View>

        <TextInput
          value={fieldName}
          onChangeText={setFieldName}
          placeholder="Field name"
          style={styles.input}
          placeholderTextColor="#777"
        />
        <TextInput
          value={cropType}
          onChangeText={setCropType}
          placeholder="Crop type (optional)"
          style={styles.input}
          placeholderTextColor="#777"
        />

        <Pressable style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]} onPress={onSave} disabled={isSaving}>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    backgroundColor: "#FAFAF8",
  },
  backBtn: { fontSize: 24, color: "#222" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C" },
  headerSpacer: { width: 18 },
  map: { flex: 1, minHeight: 320 },
  panel: { maxHeight: 320, backgroundColor: "#FAFAF8" },
  panelContent: { padding: 16, paddingBottom: 28 },
  helpText: { color: "#4A4A4A", marginBottom: 12 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  stat: { fontSize: 14, fontWeight: "600", color: "#1E1E1E" },
  actionsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#B6B6B6",
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  actionBtnText: { color: "#333", fontWeight: "600" },
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
  saveBtn: {
    marginTop: 4,
    backgroundColor: "#2E7D32",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});
