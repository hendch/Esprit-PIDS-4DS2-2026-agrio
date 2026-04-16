import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Routes } from "../../core/navigation/routes";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useTheme } from "../../core/theme/useTheme";
import { useMarketPricesStore } from "./store";
import { styles } from "./MarketPricesScreen.styles";

// Series display names — shorter than the full description
const SERIES_LABELS: Record<string, string> = {
  brebis_suitees: "Ewes + Lambs",
  genisses_pleines: "In-calf Heifers",
  vaches_suitees: "Cows + Calves",
  viandes_rouges: "Red Meat",
  bovins_suivis: "Monitored Cattle",
  vaches_gestantes: "Pregnant Cows",
};

function TabBar({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabs = [
    { key: "Home", icon: "🏠", route: Routes.Dashboard },
    { key: "Land", icon: "🗺️", route: Routes.Satellite },
    { key: "Crop", icon: "🌱", route: Routes.DiseaseDetection },
    { key: "Water", icon: "💧", route: Routes.Irrigation },
    { key: "Livestock", icon: "🐄", route: Routes.Livestock },
    { key: "Prices", icon: "📈", route: Routes.MarketPrices },
    { key: "Community", icon: "👥", route: Routes.Community },
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

export function MarketPricesScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();

  const {
    series,
    seriesLoading,
    seriesError,
    selectedSeries,
    history,
    historyLoading,
    forecasts,
    forecastLoading,
    forecastError,
    fetchSeries,
    setSelectedSeries,
    fetchHistory,
    fetchForecast,
  } = useMarketPricesStore();

  const [slowWarning, setSlowWarning] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("national");

  const REGIONS = [
    { key: "national",      label: "National" },
    { key: "nord",          label: "Nord" },
    { key: "sahel",         label: "Sahel" },
    { key: "centre_et_sud", label: "Centre-Sud" },
  ];

  // Load series list on mount
  useEffect(() => {
    fetchSeries();
  }, []);

  // Load history + forecast when selected series changes; reset region to national
  useEffect(() => {
    setSelectedRegion("national");
    fetchHistory(selectedSeries, "2021-01");
    fetchForecast(selectedSeries, 12, false, "national");
  }, [selectedSeries]);

  // Fetch forecast for newly selected region (if not already cached)
  useEffect(() => {
    if (!forecasts[selectedRegion]) {
      fetchForecast(selectedSeries, 12, false, selectedRegion);
    }
  }, [selectedRegion]);

  // Show slow-warning after 20 s of forecast loading
  useEffect(() => {
    if (!forecastLoading) { setSlowWarning(false); return; }
    const t = setTimeout(() => setSlowWarning(true), 20000);
    return () => clearTimeout(t);
  }, [forecastLoading]);

  const forecast = forecasts[selectedRegion] ?? null;

  const formatTND = (value: number, unit: string) =>
    unit === "TND/kg"
      ? `${value.toFixed(2)} TND/kg`
      : `${Math.round(value).toLocaleString("fr-TN")} TND`;

  const handleSelectSeries = useCallback(
    (name: string) => {
      setSelectedSeries(name);
    },
    [setSelectedSeries]
  );

  const handleRunForecast = useCallback(() => {
    fetchForecast(selectedSeries, 12, true, selectedRegion);
  }, [selectedSeries, selectedRegion, fetchForecast]);

  // Selected series metadata
  const selectedInfo = series.find((s) => s.series_name === selectedSeries);

  // --- History mini-bar chart ---
  const graphWidth = width - 24 * 2 - 24;
  const graphHeight = 90;
  const historyValues = history.map((p) => p.price);
  const minHist = Math.min(...(historyValues.length ? historyValues : [0]));
  const maxHist = Math.max(...(historyValues.length ? historyValues : [1]));
  const histRange = maxHist - minHist || 1;

  // Show every 4th label to avoid clutter
  const historyLabels = history
    .filter((_, i) => i % Math.max(1, Math.floor(history.length / 6)) === 0)
    .map((p) => p.date.slice(0, 7).replace(/-/g, "/"));

  // --- Forecast rows (show up to 6) ---
  const forecastRows = forecast?.forecast.slice(0, 6) ?? [];

  // CAGR colour
  const cagrColor =
    (selectedInfo?.cagr_pct ?? 0) >= 0 ? "#2E7D32" : "#C62828";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
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
        <TouchableOpacity onPress={() => useDrawerStore.getState().openDrawer()}>
          <Text style={styles.hamburger}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>Agrio</Text>
        </View>
        <Text style={styles.headerRight}>Prices</Text>
      </View>

      {/* Full-screen loader while fetching series list */}
      {seriesLoading && series.length === 0 && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1E88E5" />
          <Text style={styles.loadingText}>Loading market data…</Text>
        </View>
      )}

      {seriesError && series.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {"Could not load series list.\n" + seriesError}
          </Text>
          <Pressable style={styles.retryBtn} onPress={fetchSeries}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {series.length > 0 && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Market Prices</Text>
          <Text style={styles.pageSubtitle}>
            Tunisian livestock price history & AI forecasts
          </Text>

          {/* Series chips */}
          <View style={styles.chipRow}>
            {series.map((s) => (
              <Pressable
                key={s.series_name}
                style={[
                  styles.chip,
                  selectedSeries === s.series_name && styles.chipActive,
                ]}
                onPress={() => handleSelectSeries(s.series_name)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedSeries === s.series_name && styles.chipTextActive,
                  ]}
                >
                  {SERIES_LABELS[s.series_name] ?? s.series_name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Summary cards */}
          {selectedInfo && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: "#1E88E5" }]}>
                  {formatTND(selectedInfo.latest_price, selectedInfo.unit)}
                </Text>
                <Text style={styles.summaryLabel}>Latest price</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: cagrColor }]}>
                  {selectedInfo.cagr_pct >= 0 ? "+" : ""}
                  {selectedInfo.cagr_pct.toFixed(1)}%
                </Text>
                <Text style={styles.summaryLabel}>Annual growth</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: "#FF9800" }]}>
                  {selectedInfo.latest_date}
                </Text>
                <Text style={styles.summaryLabel}>Last update</Text>
              </View>
            </View>
          )}

          {/* Regional prices */}
          {selectedInfo &&
            Object.entries(selectedInfo.regions).filter(([, v]) => v !== null)
              .length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Regional Prices</Text>
              <View style={styles.summaryRow}>
                {Object.entries(selectedInfo.regions)
                  .filter(([, v]) => v !== null)
                  .map(([region, price]) => (
                    <View key={region} style={styles.summaryCard}>
                      <Text style={[styles.summaryValue, { color: "#2E7D32", fontSize: 16 }]}>
                        {formatTND(price as number, selectedInfo.unit)}
                      </Text>
                      <Text style={styles.summaryLabel}>
                        {region === "centre_et_sud" ? "Centre/Sud" : region.charAt(0).toUpperCase() + region.slice(1)}
                      </Text>
                    </View>
                  ))}
              </View>
            </>
          )}

          {/* Price history chart */}
          <Text style={styles.sectionTitle}>Price History</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>
                  {SERIES_LABELS[selectedSeries] ?? selectedSeries}
                </Text>
                <Text style={styles.chartSubtitle}>National average · monthly</Text>
              </View>
              {selectedInfo && (
                <View style={styles.unitPill}>
                  <Text style={styles.unitText}>TND / head</Text>
                </View>
              )}
            </View>

            {historyLoading ? (
              <ActivityIndicator size="small" color="#1E88E5" style={{ marginVertical: 20 }} />
            ) : history.length > 0 ? (
              <>
                <View
                  style={[
                    styles.graphArea,
                    { width: graphWidth, height: graphHeight },
                  ]}
                >
                  {historyValues.map((val, i) => (
                    <View
                      key={i}
                      style={[
                        styles.graphBar,
                        {
                          width: Math.max(
                            3,
                            graphWidth / historyValues.length - 2
                          ),
                          height: Math.max(
                            6,
                            ((val - minHist) / histRange) * (graphHeight - 12) + 6
                          ),
                        },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.graphXLabels}>
                  {historyLabels.map((l, i) => (
                    <Text key={i} style={styles.graphXLabel}>
                      {l}
                    </Text>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[styles.loadingText, { textAlign: "center" }]}>
                No history available. Run a forecast to populate history.
              </Text>
            )}
          </View>

          {/* Region selector — hidden for viandes_rouges */}
          {selectedSeries !== "viandes_rouges" && (
            <>
              <Text style={styles.sectionTitle}>Forecast Region</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
              >
                {REGIONS.map((r) => (
                  <Pressable
                    key={r.key}
                    onPress={() => setSelectedRegion(r.key)}
                    style={[
                      styles.chip,
                      selectedRegion === r.key && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedRegion === r.key && styles.chipTextActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {/* Run forecast button */}
          <Pressable
            style={({ pressed }) => [
              styles.runForecastBtn,
              forecastLoading && { opacity: 0.7 },
              pressed && styles.pressed,
            ]}
            onPress={handleRunForecast}
            disabled={forecastLoading}
          >
            {forecastLoading ? (
              <>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={[styles.runForecastBtnText, { marginTop: 6 }]}>
                  Training forecast model…
                </Text>
              </>
            ) : (
              <Text style={styles.runForecastBtnText}>
                {forecast ? "Refresh Forecast" : "Run AI Forecast"}
              </Text>
            )}
          </Pressable>

          {slowWarning && (
            <Text style={{ color: "#F9A825", fontSize: 13, textAlign: "center", marginTop: -16, marginBottom: 16 }}>
              Taking longer than usual — models are training for the first time
            </Text>
          )}

          {forecastError && (
            <Text style={[styles.errorText, { marginBottom: 16 }]}>
              Forecast error: {forecastError}
            </Text>
          )}

          {/* Forecast table */}
          {forecast && (
            <>
              <Text style={styles.sectionTitle}>12-Month Forecast</Text>
              <View style={styles.forecastCard}>
                <View style={styles.forecastHeaderRow}>
                  <Text style={styles.chartTitle}>
                    {(REGIONS.find((r) => r.key === selectedRegion)?.label ?? "National")} · Point forecast + 80% interval
                  </Text>
                  <View style={styles.modelPill}>
                    <Text style={styles.modelPillText}>
                      {forecast.model_used.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {forecastRows.map((fp) => (
                  <View key={fp.date} style={styles.forecastRow}>
                    <Text style={styles.forecastDate}>
                      {fp.date.slice(0, 7)}
                    </Text>
                    <Text style={styles.forecastValue}>
                      {selectedInfo
                        ? formatTND(fp.forecast, selectedInfo.unit)
                        : Math.round(fp.forecast).toLocaleString("fr-TN")}
                    </Text>
                    <Text style={styles.forecastRange}>
                      {Math.round(fp.lower_80).toLocaleString("fr-TN")}
                      {" – "}
                      {Math.round(fp.upper_80).toLocaleString("fr-TN")}
                    </Text>
                  </View>
                ))}
              </View>

              {/* AI trend summary */}
              <View style={styles.trendCard}>
                <Text style={styles.trendTitle}>AI Price Outlook</Text>
                <View style={styles.trendRow}>
                  <Text style={styles.trendIcon}>📊</Text>
                  <Text style={styles.trendText}>
                    Model:{" "}
                    <Text style={{ fontWeight: "700" }}>
                      {forecast.model_used.toUpperCase()}
                    </Text>{" "}
                    · Horizon: {forecast.horizon} months
                  </Text>
                </View>
                <View style={styles.trendRow}>
                  <Text style={styles.trendIcon}>📅</Text>
                  <Text style={styles.trendText}>
                    Generated{" "}
                    {new Date(forecast.generated_at).toLocaleDateString()}
                  </Text>
                </View>
                {forecastRows.length > 0 && (
                  <View style={styles.trendRow}>
                    <Text style={styles.trendIcon}>
                      {forecastRows[forecastRows.length - 1].forecast >
                      forecastRows[0].forecast
                        ? "📈"
                        : "📉"}
                    </Text>
                    <Text style={styles.trendText}>
                      Trend over the forecast period:{" "}
                      <Text style={{ fontWeight: "700" }}>
                        {(
                          ((forecastRows[forecastRows.length - 1].forecast -
                            forecastRows[0].forecast) /
                            forecastRows[0].forecast) *
                          100
                        ).toFixed(1)}
                        %
                      </Text>
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      <TabBar active="Prices" />
    </View>
  );
}
