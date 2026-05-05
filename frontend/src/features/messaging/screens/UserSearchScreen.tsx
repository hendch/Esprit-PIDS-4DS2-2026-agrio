import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Routes } from "../../../core/navigation/routes";
import { useTheme } from "../../../core/theme/useTheme";
import { messagingApi, SearchUser } from "../services/messagingApi";

function getUserName(user: SearchUser): string {
  return user.display_name || user.email;
}

export function UserSearchScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const data = await messagingApi.searchUsers(query);
      setUsers(data);
    } catch (error: any) {
      Alert.alert("Search failed", "Could not search users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      search();
    }, 400);

    return () => clearTimeout(timeout);
  }, [query]);

  const startChat = async (user: SearchUser) => {
    try {
      const conversation = await messagingApi.createOrGetDirectConversation(user.id);

      nav.navigate(Routes.Chat, {
        conversationId: conversation.id,
        otherUser: user,
      });
    } catch (error: any) {
      Alert.alert("Could not start chat", error?.response?.data?.detail || "Please try again.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or email..."
        placeholderTextColor="#999"
        style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg }]}
        autoCapitalize="none"
      />

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : null}

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Search for another Agrio user.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => startChat(item)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getUserName(item).slice(0, 2).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>{getUserName(item)}</Text>
              <Text style={[styles.email, { color: colors.textSecondary }]}>{item.email}</Text>
            </View>

            <Text style={styles.messageText}>Message</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#FFF", fontWeight: "800" },
  name: { fontSize: 16, fontWeight: "700" },
  email: { fontSize: 13, marginTop: 3 },
  messageText: { color: "#4CAF50", fontWeight: "800" },
  empty: { alignItems: "center", marginTop: 80 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyText: { fontSize: 15 },
});