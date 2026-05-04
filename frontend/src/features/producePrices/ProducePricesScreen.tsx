import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Routes } from "../../core/navigation/routes";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useTheme } from "../../core/theme/useTheme";
import { useProducePricesStore } from "./store";
import { styles } from "./ProducePricesScreen.styles";
import type { ProduceProduct } from "./types";

const SEASONS: Record<string, number[]> = {
  clementine: [10, 11, 12, 1, 2],
  maltaise:   [2, 3, 4, 5],
  thomson:    [11, 12, 1, 2, 3],
};

const currentMonth = new Date().getMonth() + 1;

const isInSeason = (product: string): boolean | null => {
  if (!SEASONS[product]) return null;
  return SEASONS[product].includes(currentMonth);
};

const formatMillimes = (v: number): string =>
  v >= 1000 ? `${(v / 1000).toFixed(2)} TND/kg` : `${Math.round(v)} millimes/kg`;

function SeasonBadge({ product }: { product: string }) {
  const inSeason = isInSeason(product);
  if (inSeason === null) return null;
  if (inSeason) {
    return (
      <View style={styles.badgeInSeason}>
        <Text style={styles.badgeInSeasonText}>En saison</Text>
      </View>
    );
  }
  return (
    <View style={styles.badgeOffSeason}>
      <Text style={styles.badgeOffSeasonText}>Hors saison</Text>
    </View>
  );
}

function ProductCard({
  item, selected, onPress,
}: {
  item: ProduceProduct; selected: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.productCard, selected && styles.productCardSelected]}
      onPress={onPress}
    >
      <Text style={styles.productCardName}>{item.display_name}</Text>
      <SeasonBadge product={item.product} />
      <Text style={styles.productCardPrice}>
        {item.latest_retail_price != null ? formatMillimes(item.latest_retail_price) : "–"}
      </Text>
      <Text style={styles.productCardWeeks}>{item.weeks_of_data} semaines</Text>
    </Pressable>
  );
}

function TabBar({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabs = [
    { key: "Home",      icon: "🏠", route: Routes.Dashboard },
    { key: "Land",      icon: "🗺️", route: Routes.Satellite },
    { key: "Crop",      icon: "🌱", route: Routes.DiseaseDetection },
    { key: "Water",     icon: "💧", route: Routes.Irrigation },
    { key: "Livestock", icon: "🐄", route: Routes.Livestock },
    { key: "Prices",    icon: "🥬", route: Routes.ProducePrices },
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

// ---------------------------------------------------------------------------
// Content component — used standalone AND embedded in PricesScreen
// ---------------------------------------------------------------------------

export function ProducePricesContent() {
  const {
    products, selectedProduct, forecasts, loading, error,
    fetchProducts, selectProduct, fetchForecast, clearError,
  } = useProducePricesStore();

  const [category, setCategory] = useState<"fruit" | "legume">("fruit");
  const [showSlowWarning, setShowSlowWarning] = useState(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchProducts(); }, []);

  const filteredProducts = products.filter((p) => p.category === category);

  const handleSelectProduct = useCallback(
    (p: ProduceProduct) => { selectProduct(p); clearError(); },
    [selectProduct, clearError]
  );

  useEffect(() => {
    if (!selectedProduct) return;
    let cancelled = false;
    setShowSlowWarning(false);
    clearError();
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => {
      if (!cancelled) setShowSlowWarning(true);
    }, 20000);
    fetchForecast(selectedProduct.product, false).finally(() => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      if (!cancelled) setShowSlowWarning(false);
    });
    return () => {
      cancelled = true;
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    };
  }, [selectedProduct?.product]);

  const forecast     = selectedProduct ? forecasts[selectedProduct.product] ?? null : null;

  // Filter to future rows only (data ends 2022; 220-week horizon reaches 2026+)
  const today = new Date().toISOString().slice(0, 10);
  const futureForecast = forecast
    ? { ...forecast, forecast: forecast.forecast.filter((fp) => fp.date >= today) }
    : null;
  const firstScenario = futureForecast?.scenarios?.find((s) => s.date >= today) ?? null;

  return (
    <>
      {loading && products.length === 0 && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1E88E5" />
          <Text style={styles.loadingText}>Chargement des produits…</Text>
        </View>
      )}

      {error && products.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{"Impossible de charger.\n" + error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchProducts}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      )}

      {products.length > 0 && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Produce Prices</Text>
          <Text style={styles.pageSubtitle}>Fruits &amp; légumes · Prévision IA hebdomadaire</Text>

          <View style={styles.categoryRow}>
            {(["fruit", "legume"] as const).map((cat) => (
              <Pressable
                key={cat}
                style={[styles.categoryPill, category === cat && styles.categoryPillActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.categoryPillText, category === cat && styles.categoryPillTextActive]}>
                  {cat === "fruit" ? "🍋 Fruits" : "🥬 Légumes"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>{category === "fruit" ? "Fruits" : "Légumes"}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 24 }}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.product}
                item={p}
                selected={selectedProduct?.product === p.product}
                onPress={() => handleSelectProduct(p)}
              />
            ))}
          </ScrollView>

          {selectedProduct && (
            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>{selectedProduct.display_name}</Text>
              <SeasonBadge product={selectedProduct.product} />
              <View style={styles.detailPriceRow}>
                <View style={styles.detailPriceBlock}>
                  <Text style={styles.detailPriceValue}>
                    {selectedProduct.latest_retail_price != null
                      ? formatMillimes(selectedProduct.latest_retail_price) : "–"}
                  </Text>
                  <Text style={styles.detailPriceLabel}>Prix de détail</Text>
                </View>
                <View style={styles.detailPriceBlock}>
                  <Text style={[styles.detailPriceValue, { color: "#555" }]}>
                    {selectedProduct.latest_wholesale_price != null
                      ? formatMillimes(selectedProduct.latest_wholesale_price) : "–"}
                  </Text>
                  <Text style={styles.detailPriceLabel}>Prix de gros</Text>
                </View>
              </View>
            </View>
          )}

          {selectedProduct && loading && (
            <View style={styles.forecastGenerating}>
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text style={styles.forecastGeneratingText}>
                {showSlowWarning ? "Entraînement du modèle en cours…" : "Génération de la prévision…"}
              </Text>
            </View>
          )}

          {error && (
            <View style={[styles.warningBox, { borderLeftColor: "#E53935" }]}>
              <Text style={[styles.warningText, { color: "#B71C1C" }]}>{error}</Text>
            </View>
          )}

          {futureForecast && futureForecast.forecast.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Prévision hebdomadaire</Text>
              <View style={styles.forecastCard}>
                <Text style={styles.forecastCardTitle}>
                  {selectedProduct?.display_name}
                </Text>
                <Text style={styles.forecastCardSubtitle}>Prix de détail · Intervalle 95%</Text>
                {futureForecast.forecast.map((fp) => (
                  <View key={fp.date} style={styles.forecastRow}>
                    <Text style={styles.forecastDate}>{fp.date}</Text>
                    <Text style={styles.forecastValue}>{formatMillimes(fp.forecast)}</Text>
                    <Text style={styles.forecastRange}>
                      {formatMillimes(fp.lower_95)} – {formatMillimes(fp.upper_95)}
                    </Text>
                  </View>
                ))}
              </View>

              {firstScenario && (
                <View style={styles.scenarioCard}>
                  <Text style={styles.scenarioTitle}>
                    Scénarios (semaine 1 · {firstScenario.date})
                  </Text>
                  {[
                    { icon: "🐻", label: "Baisse", value: firstScenario.pessimistic },
                    { icon: "📉", label: "Bas",    value: (firstScenario.pessimistic + firstScenario.baseline) / 2 },
                    { icon: "➡️", label: "Base",   value: firstScenario.baseline },
                    { icon: "📈", label: "Haut",   value: (firstScenario.baseline + firstScenario.optimistic) / 2 },
                    { icon: "🚀", label: "Hausse", value: firstScenario.optimistic },
                  ].map((s) => (
                    <View key={s.label} style={styles.scenarioRow}>
                      <Text style={styles.scenarioLabel}>{s.icon} {s.label}</Text>
                      <Text style={styles.scenarioValue}>{formatMillimes(s.value)}</Text>
                    </View>
                  ))}
                </View>
              )}


              {forecast?.warnings && forecast.warnings.length > 0 && (
                <View style={styles.warningBox}>
                  {forecast.warnings.map((w, i) => (
                    <Text key={i} style={styles.warningText}>⚠️ {w}</Text>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Standalone screen wrapper
// ---------------------------------------------------------------------------

export function ProducePricesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <Text style={styles.headerRight}>Produce</Text>
      </View>
      <ProducePricesContent />
      <TabBar active="Prices" />
    </View>
  );
}
