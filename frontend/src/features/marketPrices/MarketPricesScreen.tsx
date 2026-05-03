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
import { SERIES_DISPLAY } from "./types";
import { useTutorialStore } from "../../core/tutorial/store";
import { useGamificationStore } from "../gamification/store";

function TabBar({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabs = [
    { key: "Home",      icon: "🏠", route: Routes.Dashboard },
    { key: "Land",      icon: "🗺️", route: Routes.Satellite },
    { key: "Crop",      icon: "🌱", route: Routes.DiseaseDetection },
    { key: "Water",     icon: "💧", route: Routes.Irrigation },
    { key: "Livestock", icon: "🐄", route: Routes.Livestock },
    { key: "Prices",    icon: "📈", route: Routes.MarketPrices },
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

export function MarketPricesContent() {
  const { width } = useWindowDimensions();
  const tutorial = useTutorialStore();
  const showForecastGotIt = tutorial.currentStep?.key === 'generate_forecast' && tutorial.isVisible;
  const showRecommendationGotIt = tutorial.currentStep?.key === 'view_recommendation' && tutorial.isVisible;

  const {
    series, seriesLoading, seriesError, selectedSeries,
    history, historyLoading, forecasts, forecastError,
    recommendation, recommendationLoading,
    fetchSeries, setSelectedSeries, fetchHistory, fetchForecast, fetchRecommendation,
  } = useMarketPricesStore();

  const [selectedRegion, setSelectedRegion] = useState("national");
  const [category, setCategory] = useState<"livestock" | "fodder">("livestock");

  const REGIONS = [
    { key: "national",      label: "National" },
    { key: "nord",          label: "Nord" },
    { key: "sahel",         label: "Sahel" },
    { key: "centre_et_sud", label: "Centre-Sud" },
  ];

  useEffect(() => {
    fetchSeries();
    useGamificationStore.getState().completeTask('check_market_prices');
  }, []);

  useEffect(() => {
    setSelectedSeries(category === "livestock" ? "brebis_suitees" : "tbn");
    setSelectedRegion("national");
  }, [category]);

  const forecastHorizon =
    SERIES_DISPLAY[selectedSeries]?.category === "fodder" ? 36 : 12;

  useEffect(() => {
    setSelectedRegion("national");
    fetchHistory(selectedSeries, "2021-01");
    fetchForecast(selectedSeries, forecastHorizon, false, "national");
  }, [selectedSeries]);

  useEffect(() => {
    if (!forecasts[selectedRegion]) {
      fetchForecast(selectedSeries, forecastHorizon, false, selectedRegion);
    }
  }, [selectedRegion]);

  useEffect(() => {
    if (selectedSeries && forecasts[selectedRegion]) {
      fetchRecommendation(selectedSeries, selectedRegion);
    }
  }, [selectedSeries, forecasts, selectedRegion]);

  const forecast = forecasts[selectedRegion] ?? null;

  const formatPrice = (value: number, unit: string): string => {
    if (!value) return "—";
    if (unit === "TND/kg")   return `${value.toFixed(2)} TND/kg`;
    if (unit === "TND/bale") return `${value.toFixed(2)} TND/bale`;
    return `${Math.round(value).toLocaleString("fr-TN")} TND`;
  };

  const formatRangeValue = (value: number, unit: string): string => {
    if (unit === "TND/kg" || unit === "TND/bale") return value.toFixed(2);
    return Math.round(value).toLocaleString("fr-TN");
  };

  const handleSelectSeries = useCallback(
    (name: string) => { setSelectedSeries(name); },
    [setSelectedSeries]
  );

  const selectedInfo = series.find((s) => s.series_name === selectedSeries);

  const graphWidth  = width - 24 * 2 - 24;
  const graphHeight = 90;
  const historyValues = history.map((p) => p.price);
  const minHist = Math.min(...(historyValues.length ? historyValues : [0]));
  const maxHist = Math.max(...(historyValues.length ? historyValues : [1]));
  const histRange = maxHist - minHist || 1;

  const historyLabels = history
    .filter((_, i) => i % Math.max(1, Math.floor(history.length / 6)) === 0)
    .map((p) => p.date.slice(0, 7).replace(/-/g, "/"));

  const isFodder = SERIES_DISPLAY[selectedSeries]?.category === "fodder";
  const today = new Date().toISOString().slice(0, 10);
  const forecastRows = isFodder
    ? (forecast?.forecast ?? []).filter((fp) => fp.date >= today).slice(0, 12)
    : (forecast?.forecast ?? []).slice(0, 6);
  const cagrColor = (selectedInfo?.cagr_pct ?? 0) >= 0 ? "#2E7D32" : "#C62828";

  const visibleSeries = (series ?? []).filter(
    (s) => (SERIES_DISPLAY[s.series_name]?.category ?? "livestock") === category
  );

  const displayLabel = SERIES_DISPLAY[selectedSeries]?.label ?? selectedSeries ?? "";

  return (
    <>
      {seriesLoading && series.length === 0 && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1E88E5" />
          <Text style={styles.loadingText}>Loading market data…</Text>
        </View>
      )}

      {seriesError && series.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{"Could not load series list.\n" + seriesError}</Text>
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
            Tunisian livestock &amp; fodder price history &amp; AI forecasts
          </Text>

          {/* Livestock / Fodder toggle */}
          <View style={styles.categoryToggle}>
            {(["livestock", "fodder"] as const).map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[styles.categoryPill, category === cat && styles.categoryPillActive]}
              >
                <Text style={[styles.categoryPillText, category === cat && styles.categoryPillTextActive]}>
                  {cat === "livestock" ? "🐄 Livestock" : "🌾 Fodder"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Series chips */}
          <View style={styles.chipRow}>
            {visibleSeries.map((s) => (
              <Pressable
                key={s.series_name}
                style={[styles.chip, selectedSeries === s.series_name && styles.chipActive]}
                onPress={() => handleSelectSeries(s.series_name)}
              >
                <Text style={[styles.chipText, selectedSeries === s.series_name && styles.chipTextActive]}>
                  {SERIES_DISPLAY[s.series_name]?.label ?? s.series_name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Summary cards */}
          {selectedInfo && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: "#1E88E5" }]}>
                  {formatPrice(selectedInfo.latest_price, selectedInfo.unit)}
                </Text>
                <Text style={styles.summaryLabel}>Latest price</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: cagrColor }]}>
                  {selectedInfo.cagr_pct >= 0 ? "+" : ""}{selectedInfo.cagr_pct.toFixed(1)}%
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
            Object.entries(selectedInfo.regions).filter(([, v]) => v !== null).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Regional Prices</Text>
              <View style={styles.summaryRow}>
                {Object.entries(selectedInfo.regions)
                  .filter(([, v]) => v !== null)
                  .map(([region, price]) => (
                    <View key={region} style={styles.summaryCard}>
                      <Text style={[styles.summaryValue, { color: "#2E7D32", fontSize: 16 }]}>
                        {formatPrice(price as number, selectedInfo.unit)}
                      </Text>
                      <Text style={styles.summaryLabel}>
                        {region === "centre_et_sud"
                          ? "Centre/Sud"
                          : region.charAt(0).toUpperCase() + region.slice(1)}
                      </Text>
                    </View>
                  ))}
              </View>
            </>
          )}

          {/* History chart */}
          <Text style={styles.sectionTitle}>Price History</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>{displayLabel}</Text>
                <Text style={styles.chartSubtitle}>National average · monthly</Text>
              </View>
              {selectedInfo && (
                <View style={styles.unitPill}>
                  <Text style={styles.unitText}>{selectedInfo.unit}</Text>
                </View>
              )}
            </View>
            {historyLoading ? (
              <ActivityIndicator size="small" color="#1E88E5" style={{ marginVertical: 20 }} />
            ) : history.length > 0 ? (
              <>
                <View style={[styles.graphArea, { width: graphWidth, height: graphHeight }]}>
                  {historyValues.map((val, i) => (
                    <View
                      key={i}
                      style={[styles.graphBar, {
                        width: Math.max(3, graphWidth / historyValues.length - 2),
                        height: Math.max(6, ((val - minHist) / histRange) * (graphHeight - 12) + 6),
                      }]}
                    />
                  ))}
                </View>
                <View style={styles.graphXLabels}>
                  {historyLabels.map((l, i) => (
                    <Text key={i} style={styles.graphXLabel}>{l}</Text>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[styles.loadingText, { textAlign: "center" }]}>
                No history available. Run a forecast to populate history.
              </Text>
            )}
          </View>

          {/* Region selector */}
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
                    style={[styles.chip, selectedRegion === r.key && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selectedRegion === r.key && styles.chipTextActive]}>
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {forecastError && (
            <Text style={[styles.errorText, { marginBottom: 16 }]}>
              Forecast error: {forecastError}
            </Text>
          )}

          {/* Forecast table */}
          {forecast && (
            <>
              <Text style={styles.sectionTitle}>{isFodder ? "36-Month Forecast" : "12-Month Forecast"}</Text>
              <View style={styles.forecastCard}>
                <Text style={styles.chartTitle}>
                  {REGIONS.find((r) => r.key === selectedRegion)?.label ?? "National"} · Point forecast + 80% interval
                </Text>
                {forecastRows.map((fp) => (
                  <View key={fp.date} style={styles.forecastRow}>
                    <Text style={styles.forecastDate}>{fp.date.slice(0, 7)}</Text>
                    <Text style={styles.forecastValue}>
                      {selectedInfo
                        ? formatPrice(fp.forecast, selectedInfo.unit)
                        : Math.round(fp.forecast).toLocaleString("fr-TN")}
                    </Text>
                    <Text style={styles.forecastRange}>
                      {formatRangeValue(fp.lower_80, selectedInfo?.unit ?? "")}
                      {" – "}
                      {formatRangeValue(fp.upper_80, selectedInfo?.unit ?? "")}
                    </Text>
                  </View>
                ))}
              </View>
              {showForecastGotIt && forecastRows.length > 0 && (
                <Pressable
                  onPress={() => tutorial.checkAndAdvance('generate_forecast')}
                  style={{
                    marginTop: 12,
                    marginHorizontal: 16,
                    backgroundColor: '#2E7D32',
                    borderRadius: 8,
                    paddingVertical: 10,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
                    ✓ Got it — I can see the forecast
                  </Text>
                </Pressable>
              )}
            </>
          )}

          {/* Recommendation card — shown after forecast loads */}
          {forecast && (recommendationLoading || recommendation) && (
            <View style={styles.recCard}>
              <Text style={styles.recTitle}>🎯 AI Price Recommendation</Text>

              {recommendationLoading && (
                <View style={styles.recLoadingRow}>
                  <ActivityIndicator size="small" color="#1E88E5" />
                  <Text style={styles.recLoadingText}>Analysing forecast…</Text>
                </View>
              )}

              {!recommendationLoading && recommendation && (
                <>
                  {/* Action banner */}
                  <View style={recommendation.action === 'wait' ? styles.recBannerWait : styles.recBannerNeutral}>
                    <Text style={[styles.recBannerText, { color: recommendation.action === 'wait' ? '#2E7D32' : '#1565C0' }]}>
                      {recommendation.action === 'wait'
                        ? '⏳ Consider waiting to sell'
                        : '➡️ Prices stable — sell anytime'}
                    </Text>
                  </View>

                  {/* Best / Worst month boxes */}
                  <View style={styles.recBoxRow}>
                    {/* Best month */}
                    <View style={[styles.recBox, styles.recBoxGreen]}>
                      <Text style={[styles.recBoxLabel, styles.recBoxLabelGreen]}>✅ Best time to sell</Text>
                      <Text style={styles.recBoxMonth}>{recommendation.best_month.month_label}</Text>
                      <Text style={styles.recBoxPrice}>
                        {formatPrice(recommendation.best_month.forecast_price, recommendation.unit)}
                      </Text>
                      <View style={[styles.recBadge, styles.recBadgeGreen]}>
                        <Text style={[styles.recBadgeText, styles.recBadgeTextGreen]}>
                          +{recommendation.best_month.pct_above_current}% vs next month
                        </Text>
                      </View>
                      <Text style={styles.recBoxRange}>
                        [{formatPrice(recommendation.best_month.lower_95, recommendation.unit)} – {formatPrice(recommendation.best_month.upper_95, recommendation.unit)}]
                      </Text>
                    </View>

                    {/* Worst month */}
                    <View style={[styles.recBox, styles.recBoxRed]}>
                      <Text style={[styles.recBoxLabel, styles.recBoxLabelRed]}>❌ Avoid selling</Text>
                      <Text style={styles.recBoxMonth}>{recommendation.worst_month.month_label}</Text>
                      <Text style={styles.recBoxPrice}>
                        {formatPrice(recommendation.worst_month.forecast_price, recommendation.unit)}
                      </Text>
                      <View style={[styles.recBadge, styles.recBadgeRed]}>
                        <Text style={[styles.recBadgeText, styles.recBadgeTextRed]}>
                          -{recommendation.worst_month.pct_below_current}% vs next month
                        </Text>
                      </View>
                      <Text style={styles.recBoxRange}>
                        [{formatPrice(recommendation.worst_month.lower_95, recommendation.unit)} – {formatPrice(recommendation.worst_month.upper_95, recommendation.unit)}]
                      </Text>
                    </View>
                  </View>

                  {/* Advice text */}
                  <View style={styles.recAdviceBox}>
                    <Text style={styles.recAdviceText}>{recommendation.sell_advice}</Text>
                  </View>
                  {recommendation.avoid_advice && (
                    <View style={styles.recAvoidBox}>
                      <Text style={styles.recAdviceText}>{recommendation.avoid_advice}</Text>
                    </View>
                  )}

                  <Text style={styles.recFootnote}>
                    ⓘ Based on SARIMA 12-month forecast · Confidence interval 95%
                  </Text>
                  {showRecommendationGotIt && (
                    <Pressable
                      onPress={() => tutorial.checkAndAdvance('view_recommendation')}
                      style={{
                        marginTop: 12,
                        backgroundColor: '#2E7D32',
                        borderRadius: 8,
                        paddingVertical: 10,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
                        ✓ Got it — I can see the recommendation
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Standalone screen wrapper (kept for backward-compat with Routes.MarketPrices
// when used outside PricesScreen)
// ---------------------------------------------------------------------------

export function MarketPricesScreen() {
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
        <Text style={styles.headerRight}>Prices</Text>
      </View>
      <MarketPricesContent />
      <TabBar active="Prices" />
    </View>
  );
}
