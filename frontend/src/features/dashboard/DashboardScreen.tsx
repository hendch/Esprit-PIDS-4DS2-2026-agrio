import React, { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomePageCard } from "../../shared/components/HomePageCard";
import { Routes } from "../../core/navigation/routes";
import { useUserStore } from "../../core/userStore/userStore";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useTheme } from "../../core/theme/useTheme";
import { GREEN, GREEN_LIGHT } from "../../core/theme/themeColors";
import { authApi } from "../auth/services/authApi";
const ORANGE_LIGHT = "#FFF3E0";
const BLUE_LIGHT = "#E3F2FD";
const BROWN_LIGHT = "#EFEBE9";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good Morning", icon: "🌅" };
  if (h < 17) return { text: "Good Afternoon", icon: "☀️" };
  return { text: "Good Evening", icon: "🌙" };
}

export function DashboardScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const displayName = useUserStore((s) => s.displayName);
  const email = useUserStore((s) => s.email);
  const accessToken = useUserStore((s) => s.accessToken);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const setUser = useUserStore((s) => s.setUser);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const greeting = getGreeting();
  const CARD_GAP = 12;
  const cardWidth = (width - 24 * 2 - CARD_GAP) / 2; // 2 columns, padding 24
  const userName = nameOverride ?? displayName ?? "User";

  useEffect(() => {
    const loadCurrentUser = async () => {
      if (!accessToken) return;
      try {
        const me = await authApi.me();
        const profileName = me.display_name?.trim() || "User";
        setNameOverride(profileName);
        setUser(profileName, me.email);
      } catch {
        setNameOverride("User");
      }
    };

    void loadCurrentUser();
  }, [accessToken, email, setUser]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Custom header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.headerBorder }]}>
        <TouchableOpacity onPress={() => useDrawerStore.getState().openDrawer()} style={styles.headerLeft}>
          <Text style={[styles.hamburger, { color: colors.text }]}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>Agrio</Text>
        </View>
        <Text style={[styles.headerRight, { color: colors.textSecondary }]}>Home</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting card */}
        <View style={styles.greetingCard}>
          <Text style={styles.greetingText}>
            {greeting.text} {greeting.icon}
          </Text>
          <Text style={styles.greetingName}>{userName}!</Text>
          <Text style={styles.greetingSub}>Let's see how your farm is doing today!</Text>
        </View>

        {/* Today's Highlights */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionIcon}>📈</Text>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Highlights</Text>
          </View>
          <View style={[styles.highlightsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.highlightsGrid}>
              <View style={styles.highlightItem}>
                <Text style={[styles.highlightLabel, { color: colors.textSecondary }]}>Water Saved</Text>
                <Text style={[styles.highlightValue, { color: colors.primary }]}>342 L</Text>
              </View>
              <View style={styles.highlightItem}>
                <Text style={[styles.highlightLabel, { color: colors.textSecondary }]}>Temperature</Text>
                <Text style={[styles.highlightValue, { color: "#2196F3" }]}>24°C</Text>
              </View>
              <View style={styles.highlightItem}>
                <Text style={[styles.highlightLabel, { color: colors.textSecondary }]}>Crop Health</Text>
                <Text style={[styles.highlightValue, { color: "#FF9800" }]}>87%</Text>
              </View>
              <View style={styles.highlightItem}>
                <Text style={[styles.highlightLabel, { color: colors.textSecondary }]}>Livestock</Text>
                <Text style={[styles.highlightValue, { color: colors.text }]}>24/24</Text>
              </View>
            </View>
          </View>
        </View>

        {/* What would you like to see today? */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>What would you like to see today?</Text>
          <View style={[styles.twoByTwo, { gap: CARD_GAP }]}>
            <View style={{ width: cardWidth }}>
              <HomePageCard
                icon="🗺️"
                title="Land Planning"
                subtitle="View field maps & NDVI"
                backgroundColor={ORANGE_LIGHT}
                onPress={() => nav.navigate(Routes.Satellite)}
              />
            </View>
            <View style={{ width: cardWidth }}>
              <HomePageCard
                icon="🌱"
                title="Crop Health"
                subtitle="AI diagnosis & monitoring"
                backgroundColor={GREEN_LIGHT}
                onPress={() => nav.navigate(Routes.DiseaseDetection)}
              />
            </View>
            <View style={{ width: cardWidth }}>
              <HomePageCard
                icon="💧"
                title="Irrigation"
                subtitle="Control water systems"
                backgroundColor={BLUE_LIGHT}
                onPress={() => nav.navigate(Routes.Irrigation)}
              />
            </View>
            <View style={{ width: cardWidth }}>
              <HomePageCard
                icon="🎯"
                title="Livestock"
                subtitle="Monitor cattle health"
                backgroundColor={BROWN_LIGHT}
                onPress={() => nav.navigate(Routes.Livestock)}
              />
            </View>
          </View>
        </View>

        {/* How to Use Agrio */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>How to Use Agrio</Text>
          <HomePageCard
            icon="📖"
            title="Quick Start Guide"
            subtitle="Learn the basics in 5 minutes"
            backgroundColor={GREEN_LIGHT}
            onPress={() => {}}
          />
          <View style={styles.videoCardWrap}>
            <Pressable
              style={({ pressed }) => [styles.videoCard, pressed && styles.videoCardPressed]}
              onPress={() => {}}
            >
              <Text style={styles.videoIcon}>▶️</Text>
              <View style={styles.videoTextWrap}>
                <Text style={styles.videoTitle}>Video Tutorials</Text>
                <View style={styles.videoSubRow}>
                  <Text style={styles.videoSubtitle}>Watch step-by-step guides</Text>
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>New</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>
        </View>

        {/* Pro Tip */}
        <View style={[styles.proTipCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.proTipTitleRow}>
            <Text style={styles.proTipIcon}>💡</Text>
            <Text style={[styles.proTipTitle, { color: colors.text }]}>Pro Tip</Text>
          </View>
          <Text style={[styles.proTipText, { color: colors.textSecondary }]}>
            Enable push notifications to receive instant alerts about critical crop health
            issues and irrigation system status.
          </Text>
          <TouchableOpacity
            style={[styles.enableNotificationsBtn, notifEnabled && { backgroundColor: "#388E3C" }]}
            disabled={notifEnabled}
          >
            <Text style={styles.enableNotificationsText}>
              {notifEnabled ? "Notifications Enabled ✓" : "Enable Notifications"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom tab bar */}
      <View style={[styles.tabBar, { paddingBottom: insets.bottom + 8, backgroundColor: colors.tabBarBg, borderTopColor: colors.tabBarBorder }]}>
        <TabItem icon="🏠" label="Home" active onPress={() => nav.navigate(Routes.Dashboard)} />
        <TabItem icon="🗺️" label="Land" onPress={() => nav.navigate(Routes.Satellite)} />
        <TabItem icon="🌱" label="Crop" onPress={() => nav.navigate(Routes.DiseaseDetection)} />
        <TabItem icon="💧" label="Water" onPress={() => nav.navigate(Routes.Irrigation)} />
        <TabItem icon="🎯" label="Livestock" onPress={() => nav.navigate(Routes.Livestock)} />
        <TabItem icon="👥" label="Community" onPress={() => nav.navigate(Routes.Community)} />
        <TabItem icon="🔔" label="Alerts" onPress={() => nav.navigate(Routes.Alerts)} />
      </View>
    </View>
  );
}

function TabItem({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <View style={[styles.tabIconWrap, active && { backgroundColor: colors.primaryLight }]}>
        <Text style={styles.tabIcon}>{icon}</Text>
      </View>
      <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.textSecondary }, active && { fontWeight: "600" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FAFAF8",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  headerLeft: { padding: 4 },
  hamburger: { fontSize: 22, color: "#2C2C2C" },
  headerCenter: { flexDirection: "row", alignItems: "center" },
  logoIcon: { fontSize: 24, marginRight: 6 },
  logoText: { fontSize: 20, fontWeight: "700", color: GREEN },
  headerRight: { fontSize: 14, color: "#666", fontWeight: "500" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20 },
  greetingCard: {
    backgroundColor: GREEN,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  greetingText: { fontSize: 14, color: "rgba(255,255,255,0.9)", marginBottom: 4 },
  greetingName: { fontSize: 28, fontWeight: "800", color: "#FFF" },
  greetingSub: { fontSize: 14, color: "rgba(255,255,255,0.9)", marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionIcon: { fontSize: 16, marginRight: 8 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2C2C2C",
    marginBottom: 12,
  },
  highlightsCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  highlightsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -10,
  },
  highlightItem: {
    width: "50%",
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  highlightLabel: { fontSize: 13, color: "#666", marginBottom: 4 },
  highlightValue: { fontSize: 20, fontWeight: "700" },
  twoByTwo: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  videoCardWrap: { marginTop: 12 },
  videoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ORANGE_LIGHT,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FFE0B2",
    padding: 16,
  },
  videoCardPressed: { opacity: 0.9 },
  videoIcon: { fontSize: 24, marginRight: 12 },
  videoTextWrap: { flex: 1 },
  videoTitle: { fontSize: 16, fontWeight: "700", color: "#2C2C2C" },
  videoSubRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  videoSubtitle: { fontSize: 13, color: "#555", marginRight: 8 },
  newBadge: {
    backgroundColor: "rgba(255,152,0,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newBadgeText: { fontSize: 11, fontWeight: "600", color: "#E65100" },
  chevron: { fontSize: 24, color: "#666", fontWeight: "300" },
  proTipCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
    padding: 20,
  },
  proTipTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  proTipIcon: { fontSize: 20, marginRight: 8 },
  proTipTitle: { fontSize: 16, fontWeight: "700", color: "#2C2C2C" },
  proTipText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
    marginBottom: 16,
  },
  enableNotificationsBtn: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: GREEN,
  },
  enableNotificationsText: { fontSize: 14, fontWeight: "600", color: GREEN },
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