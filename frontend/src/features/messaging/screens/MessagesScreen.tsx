import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Routes } from "../../../core/navigation/routes";
import { useTheme } from "../../../core/theme/useTheme";
import { Conversation, messagingApi } from "../services/messagingApi";

function getUserName(conversation: Conversation): string {
  return (
    conversation.other_user?.display_name ||
    conversation.other_user?.email ||
    "Unknown user"
  );
}

function formatTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString();
}

export function MessagesScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = async () => {
    const data = await messagingApi.getConversations();
    setConversations(data);
  };

  useEffect(() => {
    loadConversations()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations().catch(console.error);
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadConversations();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10, color: colors.text }}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Farmer Connect</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Message other Agrio users privately
          </Text>
        </View>

        <TouchableOpacity
          style={styles.findButton}
          onPress={() => nav.navigate(Routes.UserSearch)}
        >
          <Text style={styles.findButtonText}>Find Users</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No conversations yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Search for another user and start your first chat.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() =>
              nav.navigate(Routes.Chat, {
                conversationId: item.id,
                otherUser: item.other_user,
              })
            }
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getUserName(item).slice(0, 2).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>{getUserName(item)}</Text>
              <Text style={[styles.lastMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.last_message?.body || "No messages yet"}
              </Text>
            </View>

            <Text style={[styles.time, { color: colors.textSecondary }]}>
              {formatTime(item.last_message?.created_at)}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 4 },
  findButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  findButtonText: { color: "#FFF", fontWeight: "700" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#FFF", fontWeight: "800" },
  name: { fontSize: 16, fontWeight: "700" },
  lastMessage: { fontSize: 14, marginTop: 4 },
  time: { fontSize: 11, marginLeft: 8, maxWidth: 80 },
  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});