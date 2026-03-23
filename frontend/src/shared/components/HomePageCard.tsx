import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";

export function HomePageCard(props: {
  icon: string;
  title: string;
  subtitle: string;
  backgroundColor: string;
  borderColor?: string;
  onPress: () => void;
}) {
  const borderColor = props.borderColor ?? props.backgroundColor;
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: props.backgroundColor,
          borderColor,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <Text style={styles.icon}>{props.icon}</Text>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{props.title}</Text>
          <Text style={styles.subtitle}>{props.subtitle}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C2C2C",
  },
  subtitle: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: "#666",
    fontWeight: "300",
  },
});
