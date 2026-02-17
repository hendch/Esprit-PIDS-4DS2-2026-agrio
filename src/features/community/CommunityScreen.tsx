import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Routes } from "../../core/navigation/routes";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useTheme } from "../../core/theme/useTheme";

const OFFSET_WHITE = "#FAFAF8";
const GREEN = "#4CAF50";
const GREEN_LIGHT = "#E8F5E9";

const FILTERS = ["All", "Irrigation", "Crop Health", "Livestock", "Land Planning"];

const POSTS = [
  {
    id: "1",
    author: "Sarah Thompson",
    initials: "ST",
    avatarColor: "#B3E5FC",
    time: "2 hours ago",
    category: "Irrigation",
    categoryColor: "#B3E5FC",
    title: "Best practices for corn irrigation in summer?",
    body: "I'm looking for advice on optimizing water usage during peak summer months. My fields are showing some stress and I want to avoid overwatering.",
    likes: 24,
    comments: 8,
  },
  {
    id: "2",
    author: "David Martinez",
    initials: "DM",
    avatarColor: "#C8E6C9",
    time: "5 hours ago",
    category: "Crop Health",
    categoryColor: "#C8E6C9",
    title: "AI-powered pest detection - worth the investment?",
    body: "Has anyone tried using AI image recognition for pest detection? Considering investing in the technology but want real user experiences first.",
    likes: 42,
    comments: 15,
  },
  {
    id: "3",
    author: "Emily Chen",
    initials: "EC",
    avatarColor: "#EFEBE9",
    time: "1 day ago",
    category: "Livestock",
    categoryColor: "#D7CCC8",
    title: "Livestock tracking systems comparison",
    body: "Looking for recommendations on GPS and health tracking systems for a herd of 50. What has worked best for you?",
    likes: 18,
    comments: 6,
  },
];

function TabBar({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabs = [
    { key: "Home", icon: "🏠", route: Routes.Dashboard },
    { key: "Land", icon: "🗺️", route: Routes.Satellite },
    { key: "Crop", icon: "🌱", route: Routes.DiseaseDetection },
    { key: "Water", icon: "💧", route: Routes.Irrigation },
    { key: "Livestock", icon: "🐄", route: Routes.Livestock },
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
          <Text style={[styles.tabLabel, active === t.key && styles.tabLabelActive]}>{t.key}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.headerBorder }]}>
        <TouchableOpacity onPress={() => useDrawerStore.getState().openDrawer()}>
          <Text style={styles.hamburger}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>Agrio</Text>
        </View>
        <Text style={styles.headerRight}>Community</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Search + Add */}
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search discussions..."
              placeholderTextColor="#999"
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => {}}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Filter tags */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              style={[styles.filterTag, selectedFilter === f && styles.filterTagActive]}
              onPress={() => setSelectedFilter(f)}
            >
              <Text style={[styles.filterTagText, selectedFilter === f && styles.filterTagTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Discussion posts */}
        {POSTS.map((p) => (
          <View key={p.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <View style={[styles.avatar, { backgroundColor: p.avatarColor }]}>
                <Text style={styles.avatarText}>{p.initials}</Text>
              </View>
              <View style={styles.postMeta}>
                <Text style={styles.postAuthor}>{p.author}</Text>
                <Text style={styles.postTime}>{p.time}</Text>
              </View>
              <View style={[styles.categoryTag, { backgroundColor: p.categoryColor }]}>
                <Text style={styles.categoryTagText}>{p.category}</Text>
              </View>
            </View>
            <Text style={styles.postTitle}>{p.title}</Text>
            <Text style={styles.postBody}>{p.body}</Text>
            <View style={styles.postFooter}>
              <View style={styles.engagement}>
                <Text style={styles.engagementIcon}>👍</Text>
                <Text style={styles.engagementCount}>{p.likes}</Text>
              </View>
              <View style={styles.engagement}>
                <Text style={styles.engagementIcon}>💬</Text>
                <Text style={styles.engagementCount}>{p.comments}</Text>
              </View>
              <Text style={styles.chevron}>⌄</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <TabBar active="Community" />
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
    backgroundColor: OFFSET_WHITE,
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
  searchRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEE",
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: { fontSize: 18, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: "#2C2C2C", paddingVertical: 0 },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  addBtnText: { fontSize: 28, color: "#FFF", fontWeight: "300", lineHeight: 32 },
  filtersScroll: { marginBottom: 20 },
  filtersContent: { paddingRight: 24 },
  filterTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#EEE",
    marginRight: 8,
  },
  filterTagActive: { backgroundColor: "#BDBDBD" },
  filterTagText: { fontSize: 14, color: "#555" },
  filterTagTextActive: { color: "#2C2C2C", fontWeight: "600" },
  postCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarText: { fontSize: 14, fontWeight: "700", color: "#37474F" },
  postMeta: { flex: 1 },
  postAuthor: { fontSize: 14, fontWeight: "600", color: "#2C2C2C" },
  postTime: { fontSize: 12, color: "#666", marginTop: 2 },
  categoryTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryTagText: { fontSize: 12, fontWeight: "600", color: "#37474F" },
  postTitle: { fontSize: 16, fontWeight: "700", color: "#2C2C2C", marginBottom: 8 },
  postBody: { fontSize: 14, color: "#555", lineHeight: 22, marginBottom: 12 },
  postFooter: { flexDirection: "row", alignItems: "center" },
  engagement: { flexDirection: "row", alignItems: "center", marginRight: 16 },
  engagementIcon: { fontSize: 16, marginRight: 4 },
  engagementCount: { fontSize: 13, color: "#666" },
  chevron: { marginLeft: "auto", fontSize: 18, color: "#999" },
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
