import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Switch,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useUserStore } from "../../core/userStore/userStore";
import { useThemeStore } from "../../core/theme/themeStore";
import { useTheme } from "../../core/theme/useTheme";
import { useLanguageStore } from "../../core/language/languageStore";
import { Routes } from "../../core/navigation/routes";
import { GREEN } from "../../core/theme/themeColors";

const DRAWER_WIDTH = 280;

const MENU_ITEMS = [
  { icon: "👤", label: "Profile" },
  { icon: "⚙️", label: "Settings" },
  { icon: "🔔", label: "Notifications" },
  { icon: "❓", label: "Help & Support" },
  { icon: "🛡️", label: "Privacy Policy" },
  { icon: "📄", label: "Terms of Service" },
  { icon: "📤", label: "Share App" },
];

export function AppDrawer() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const isOpen = useDrawerStore((s) => s.isOpen);
  const closeDrawer = useDrawerStore((s) => s.closeDrawer);
  const displayName = useUserStore((s) => s.displayName);
  const clearUser = useUserStore((s) => s.clearUser);
  const isDark = useThemeStore((s) => s.isDark);
  const toggleDark = useThemeStore((s) => s.toggleDark);
  const language = useLanguageStore((s) => s.language);
  const toggleLanguage = useLanguageStore((s) => s.toggleLanguage);

  const slideAnim = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isOpen ? 0 : -DRAWER_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: isOpen ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, slideAnim, overlayOpacity]);

  const handleLogout = () => {
    closeDrawer();
    clearUser();
    nav.reset({ index: 0, routes: [{ name: Routes.Login }] });
  };

  const name = displayName ?? "User";
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayOpacity,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
        pointerEvents={isOpen ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
      </Animated.View>
      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
            transform: [{ translateX: slideAnim }],
            backgroundColor: colors.card,
          },
        ]}
      >
        {/* Green header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.logoRow}>
              <Text style={styles.logoIcon}>🌿</Text>
              <Text style={styles.logoText}>Agrio</Text>
            </View>
            <TouchableOpacity onPress={closeDrawer} hitSlop={12}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{name}</Text>
              <Text style={styles.userRole}>Farm Manager</Text>
            </View>
          </View>
        </View>

        {/* Menu items */}
        <View style={styles.menu}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, { borderBottomColor: colors.cardBorder }]}
              onPress={() => closeDrawer()}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={[styles.menuItem, styles.darkModeRow, { borderBottomColor: colors.cardBorder }]}>
            <Text style={styles.menuIcon}>🌙</Text>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleDark}
              trackColor={{ false: "#767577", true: colors.primaryLight }}
              thumbColor={isDark ? colors.primary : "#f4f3f4"}
            />
          </View>
          <View style={[styles.menuItem, styles.darkModeRow, { borderBottomColor: colors.cardBorder }]}>
            <Text style={styles.menuIcon}>🌐</Text>
            <Text style={[styles.menuLabel, { color: colors.text }]}>
              {language === "en" ? "العربية" : "English"}
            </Text>
            <Switch
              value={language === "ar"}
              onValueChange={toggleLanguage}
              trackColor={{ false: "#767577", true: colors.primaryLight }}
              thumbColor={language === "ar" ? colors.primary : "#f4f3f4"}
            />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable style={({ pressed }) => [styles.logoutBtn, { backgroundColor: colors.card, borderColor: "#E53935" }, pressed && styles.logoutBtnPressed]} onPress={handleLogout}>
            <Text style={styles.logoutArrow}>→</Text>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
          <Text style={[styles.version, { color: colors.textSecondary }]}>Agrio v1.0.0</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    backgroundColor: GREEN,
    marginHorizontal: -1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  logoRow: { flexDirection: "row", alignItems: "center" },
  logoIcon: { fontSize: 24, marginRight: 8 },
  logoText: { fontSize: 20, fontWeight: "700", color: "rgba(255,255,255,0.95)" },
  closeBtn: { fontSize: 22, color: "#FFF", fontWeight: "300" },
  userRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  userRole: { fontSize: 13, color: "rgba(255,255,255,0.9)", marginTop: 2 },
  menu: { paddingHorizontal: 20, paddingTop: 16 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  darkModeRow: { justifyContent: "space-between" },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: { fontSize: 16, flex: 1 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    marginTop: "auto",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  logoutBtnPressed: { opacity: 0.9 },
  logoutArrow: { fontSize: 18, color: "#E53935", marginRight: 8 },
  logoutText: { fontSize: 16, fontWeight: "600", color: "#E53935" },
  version: { fontSize: 12, color: "#999", textAlign: "center", marginTop: 16 },
});
