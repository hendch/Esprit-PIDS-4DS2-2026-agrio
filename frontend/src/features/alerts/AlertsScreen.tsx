import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Routes } from "../../core/navigation/routes";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useTheme } from "../../core/theme/useTheme";
import {
  alertsApi,
  PriceAlert,
  SERIES_DISPLAY,
  SERIES_UNIT,
} from "./alertsApi";
import { useTutorialStore } from "../../core/tutorial/store";

const OFFSET_WHITE = "#FAFAF8";
const GREEN = "#4CAF50";
const GREEN_LIGHT = "#E8F5E9";

const SERIES_KEYS = Object.keys(SERIES_DISPLAY);

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function alertToCard(alert: PriceAlert) {
  const display = SERIES_DISPLAY[alert.series_name] ?? alert.series_name;
  const unit = SERIES_UNIT[alert.series_name] ?? "TND";
  const isAbove = alert.condition === "above";
  return {
    id: alert.id,
    icon: isAbove ? "📈" : "📉",
    borderColor: isAbove ? "#FF9800" : "#2196F3",
    title: display,
    desc: `Alert fires when price goes ${alert.condition} ${alert.threshold} ${unit}.${
      alert.last_triggered_at
        ? ` Last triggered ${formatRelativeTime(alert.last_triggered_at)}.`
        : " Not triggered yet."
    }`,
    location: alert.series_name,
    time: formatRelativeTime(alert.created_at),
    is_active: alert.is_active,
    raw: alert,
  };
}

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
    { key: "Alerts", icon: "🔔", route: Routes.Alerts },
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

export function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline form state
  const [showForm, setShowForm] = useState(false);
  const [newSeries, setNewSeries] = useState(SERIES_KEYS[0]);
  const [newCondition, setNewCondition] = useState<"above" | "below">("above");
  const [newThreshold, setNewThreshold] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAlerts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await alertsApi.getAlerts();
      setAlerts(data);
    } catch {
      setError("Could not load alerts. Pull to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleResolve = async (alert: PriceAlert) => {
    try {
      const updated = await alertsApi.updateAlert(alert.id, { is_active: false });
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch {
      // silently ignore — user can refresh
    }
  };

  const handleCreate = async () => {
    const threshold = parseFloat(newThreshold);
    if (isNaN(threshold) || threshold <= 0) {
      Alert.alert("Invalid threshold", "Please enter a positive number.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await alertsApi.createAlert({
        series_name: newSeries,
        condition: newCondition,
        threshold,
      });
      setAlerts((prev) => [created, ...prev]);
      setShowForm(false);
      setNewThreshold("");
      setNewSeries(SERIES_KEYS[0]);
      setNewCondition("above");
      useTutorialStore.getState().checkAndAdvance('set_price_alert');
    } catch {
      Alert.alert("Error", "Could not create alert. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setNewThreshold("");
  };

  const activeAlerts = alerts.filter((a) => a.is_active);
  const aboveCount = activeAlerts.filter((a) => a.condition === "above").length;
  const belowCount = activeAlerts.filter((a) => a.condition === "below").length;
  const resolvedCount = alerts.filter((a) => !a.is_active).length;
  const cards = alerts.map(alertToCard);

  return (
    <View style={{ flex: 1 }}>
      {/* ── Main screen ── */}
      <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          <Text style={styles.headerRight}>Alerts</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchAlerts(true);
              }}
              tintColor={GREEN}
            />
          }
        >
          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.pageTitle}>Price Alerts</Text>
              <Text style={styles.pageSubtitle}>
                {loading
                  ? "Loading…"
                  : error
                  ? error
                  : `${activeAlerts.length} active alert${activeAlerts.length !== 1 ? "s" : ""}.`}
              </Text>
            </View>
            <Pressable style={styles.headerAddBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.headerAddBtnText}>＋</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} />
          ) : (
            <>
              {alerts.length > 0 && (
                <View style={styles.summaryRow}>
                  <View style={[styles.summaryCard, styles.summaryWarning]}>
                    <Text style={styles.summaryValue}>{aboveCount}</Text>
                    <Text style={styles.summaryLabel}>Above</Text>
                  </View>
                  <View style={[styles.summaryCard, styles.summaryInfo]}>
                    <Text style={styles.summaryValue}>{belowCount}</Text>
                    <Text style={styles.summaryLabel}>Below</Text>
                  </View>
                  <View style={[styles.summaryCard, styles.summaryResolved]}>
                    <Text style={styles.summaryValue}>{resolvedCount}</Text>
                    <Text style={styles.summaryLabel}>Resolved</Text>
                  </View>
                </View>
              )}

              {alerts.length === 0 && !error && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🔕</Text>
                  <Text style={styles.emptyTitle}>No price alerts yet</Text>
                  <Text style={styles.emptyDesc}>Tap ＋ to create your first price alert</Text>
                </View>
              )}

              {cards.map((card) => (
                <View
                  key={card.id}
                  style={[
                    styles.alertCard,
                    { borderColor: card.is_active ? card.borderColor : "#CCC" },
                    !card.is_active && styles.alertCardResolved,
                  ]}
                >
                  <View style={styles.alertHeader}>
                    <Text style={styles.alertIcon}>{card.icon}</Text>
                    <Text style={[styles.alertTitle, !card.is_active && styles.alertTitleMuted]}>
                      {card.title}
                    </Text>
                    {!card.is_active && (
                      <View style={styles.resolvedPill}>
                        <Text style={styles.resolvedPillText}>Resolved</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.alertDesc}>{card.desc}</Text>
                  <View style={styles.alertMeta}>
                    <Text style={styles.alertMetaText}>📊 {card.location}</Text>
                    <Text style={styles.alertMetaText}>🕐 {card.time}</Text>
                  </View>
                  {card.is_active && (
                    <View style={styles.alertActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.actionBtnSecondary,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => handleResolve(card.raw)}
                      >
                        <Text style={styles.actionBtnSecondaryText}>✓ Mark Resolved</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>

        <TabBar active="Alerts" />

      </View>

      {/* ── Inline bottom sheet (no Modal) ── */}
      {showForm && (
        <>
          {/* Dimmed backdrop */}
          <Pressable
            style={styles.backdrop}
            onPress={closeForm}
          />

          {/* Form sheet */}
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.sheetWrapper}
          >
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>New Price Alert</Text>

              {/* Series picker */}
              <Text style={styles.fieldLabel}>Price series</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroll}
                contentContainerStyle={styles.chipRow}
              >
                {SERIES_KEYS.map((key) => (
                  <Pressable
                    key={key}
                    style={[styles.chip, newSeries === key && styles.chipActive]}
                    onPress={() => setNewSeries(key)}
                  >
                    <Text style={[styles.chipText, newSeries === key && styles.chipTextActive]}>
                      {SERIES_DISPLAY[key]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Condition toggle */}
              <Text style={styles.fieldLabel}>Condition</Text>
              <View style={styles.toggleRow}>
                <Pressable
                  style={[styles.toggleBtn, newCondition === "above" && styles.toggleBtnActive]}
                  onPress={() => setNewCondition("above")}
                >
                  <Text
                    style={[styles.toggleText, newCondition === "above" && styles.toggleTextActive]}
                  >
                    📈 Above
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.toggleBtn, newCondition === "below" && styles.toggleBtnActive]}
                  onPress={() => setNewCondition("below")}
                >
                  <Text
                    style={[styles.toggleText, newCondition === "below" && styles.toggleTextActive]}
                  >
                    📉 Below
                  </Text>
                </Pressable>
              </View>

              {/* Threshold */}
              <Text style={styles.fieldLabel}>
                Threshold ({SERIES_UNIT[newSeries] ?? "TND"})
              </Text>
              <TextInput
                style={styles.thresholdInput}
                placeholder={`e.g. ${newCondition === "above" ? "20" : "15"}`}
                placeholderTextColor="#AAA"
                keyboardType="numeric"
                value={newThreshold}
                onChangeText={setNewThreshold}
              />

              {/* Actions */}
              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={closeForm}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.createBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleCreate}
                  disabled={submitting}
                >
                  <Text style={styles.createBtnText}>
                    {submitting ? "Creating…" : "Create Alert"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OFFSET_WHITE },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  hamburger: { fontSize: 22, color: "#2C2C2C" },
  headerCenter: { flexDirection: "row", alignItems: "center" },
  logoIcon: { fontSize: 24, marginRight: 6 },
  logoText: { fontSize: 20, fontWeight: "700", color: GREEN },
  headerRight: { fontSize: 14, color: "#666", fontWeight: "500" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20 },
  pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  pageTitle: { fontSize: 22, fontWeight: "800", color: "#2C2C2C", marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: "#666" },
  headerAddBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  headerAddBtnText: { fontSize: 26, color: "#FFF", fontWeight: "700", lineHeight: 30 },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
  },
  summaryWarning: { borderColor: "#FFB74D" },
  summaryInfo: { borderColor: "#64B5F6" },
  summaryResolved: { borderColor: "#A5D6A7" },
  summaryValue: { fontSize: 28, fontWeight: "800", color: "#2C2C2C" },
  summaryLabel: { fontSize: 12, color: "#666", marginTop: 4 },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C", marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 22 },
  alertCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  alertCardResolved: { opacity: 0.6 },
  alertHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  alertIcon: { fontSize: 22, marginRight: 10 },
  alertTitle: { fontSize: 16, fontWeight: "700", color: "#2C2C2C", flex: 1 },
  alertTitleMuted: { color: "#999" },
  resolvedPill: {
    backgroundColor: "#A5D6A7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  resolvedPillText: { fontSize: 11, fontWeight: "600", color: "#2E7D32" },
  alertDesc: { fontSize: 14, color: "#555", lineHeight: 22, marginBottom: 12 },
  alertMeta: { flexDirection: "row", gap: 16, marginBottom: 12 },
  alertMetaText: { fontSize: 13, color: "#666" },
  alertActions: { flexDirection: "row", gap: 12 },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEE",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  actionBtnSecondaryText: { fontSize: 14, fontWeight: "600", color: "#2C2C2C" },
  pressed: { opacity: 0.9 },
  // FAB
  fab: {
    position: "absolute",
    bottom: 24 + 80 + 40,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: "#FFF", fontWeight: "700", lineHeight: 34 },
  // Inline sheet
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDD",
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#2C2C2C", marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 8 },
  chipScroll: { marginBottom: 20 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  chipActive: { backgroundColor: GREEN_LIGHT, borderColor: GREEN },
  chipText: { fontSize: 13, color: "#555" },
  chipTextActive: { color: "#2E7D32", fontWeight: "600" },
  toggleRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  toggleBtnActive: { backgroundColor: GREEN_LIGHT, borderColor: GREEN },
  toggleText: { fontSize: 14, fontWeight: "600", color: "#555" },
  toggleTextActive: { color: "#2E7D32" },
  thresholdInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#2C2C2C",
    marginBottom: 24,
  },
  modalActions: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#F0F0F0",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: "#555" },
  createBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: GREEN,
  },
  createBtnText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  // Tab bar
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 12,
    paddingHorizontal: 8,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  tabItem: { alignItems: "center", flex: 1 },
  tabIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  tabIconWrapActive: { backgroundColor: GREEN_LIGHT },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 10, color: "#666" },
  tabLabelActive: { color: GREEN, fontWeight: "600" },
});
