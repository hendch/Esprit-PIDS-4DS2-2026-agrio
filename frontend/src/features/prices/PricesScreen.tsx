import React, { useState } from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Routes } from "../../core/navigation/routes";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useTheme } from "../../core/theme/useTheme";
import { styles } from "../marketPrices/MarketPricesScreen.styles";
import { MarketPricesContent } from "../marketPrices/MarketPricesScreen";
import { ProducePricesContent } from "../producePrices/ProducePricesScreen";

function TabBar({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabs = [
    { key: "Home",      icon: "🏠", route: Routes.Dashboard },
    { key: "Land",      icon: "🗺️", route: Routes.Satellite },
    { key: "Crop",      icon: "🌱", route: Routes.DiseaseDetection },
    { key: "Water",     icon: "💧", route: Routes.Irrigation },
    { key: "Livestock", icon: "🐄", route: Routes.Livestock },
    { key: "Prices",    icon: "💰", route: Routes.MarketPrices },
    { key: "Community", icon: "👥", route: Routes.Community },
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

export function PricesScreen({ route }: { route?: any }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [segment, setSegment] = useState<"market" | "produce">(
    route?.name === Routes.ProducePrices ? "produce" : "market"
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Shared header */}
      <View
        style={[styles.header, {
          paddingTop: insets.top + 8,
          backgroundColor: colors.background,
          borderBottomColor: colors.headerBorder,
        }]}
      >
        <TouchableOpacity onPress={() => useDrawerStore.getState().openDrawer()}>
          <Text style={styles.hamburger}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>Agrio</Text>
        </View>
        <Text style={styles.headerRight}>Prices</Text>
      </View>

      {/* Top-level segment toggle: Market | Produce */}
      <View style={[styles.categoryToggle, { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 2 }]}>
        <Pressable
          onPress={() => setSegment("market")}
          style={[styles.categoryPill, segment === "market" && styles.categoryPillActive]}
        >
          <Text style={[styles.categoryPillText, segment === "market" && styles.categoryPillTextActive]}>
            📈 Market
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSegment("produce")}
          style={[styles.categoryPill, segment === "produce" && styles.categoryPillActive]}
        >
          <Text style={[styles.categoryPillText, segment === "produce" && styles.categoryPillTextActive]}>
            🥬 Produce
          </Text>
        </Pressable>
      </View>

      {/* Content area */}
      <View style={{ flex: 1 }}>
        {segment === "market" ? <MarketPricesContent /> : <ProducePricesContent />}
      </View>

      <TabBar active="Prices" />
    </View>
  );
}
