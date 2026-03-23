import React from "react";
import { Pressable, Text, View } from "react-native";

export function DashboardCard(props: {
  title: string;
  subtitle?: string;
  emoji?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => ({
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#ddd",
        backgroundColor: pressed ? "#f2f2f2" : "#fff",
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 22 }}>{props.emoji ?? "🧩"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>{props.title}</Text>
          {!!props.subtitle && (
            <Text style={{ marginTop: 4, color: "#555" }}>{props.subtitle}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
