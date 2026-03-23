import React from "react";
import { View, Text } from "react-native";

export function SatelliteScreen() {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Satellite Intelligence</Text>
      <Text style={{ marginTop: 8, color: "#555" }}>
        Stub screen — will later show zoning maps (NDVI/VRA) and recommendations.
      </Text>
    </View>
  );
}
