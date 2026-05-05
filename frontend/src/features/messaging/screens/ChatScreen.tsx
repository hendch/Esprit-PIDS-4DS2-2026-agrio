import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useRef, useState } from "react";

import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Platform,
  Alert,
} from "react-native";

import { RouteProp, useRoute } from "@react-navigation/native";
import { useTheme } from "../../../core/theme/useTheme";
import { useUserStore } from "../../../core/userStore/userStore";
import { Message, SearchUser, messagingApi } from "../services/messagingApi";

type ChatRouteParams = {
  Chat: {
    conversationId: string;
    otherUser?: SearchUser | null;
  };
};

function formatTime(value: string): string {
  const date = new Date(value);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatScreen() {
  const route = useRoute<RouteProp<ChatRouteParams, "Chat">>();
  const { conversationId, otherUser } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const currentUserId = useUserStore((s) => s.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList<Message>>(null);

  const loadMessages = async () => {
    const data = await messagingApi.getMessages(conversationId);
    setMessages(data);
  };

  useEffect(() => {
    loadMessages().catch(console.error);

    const interval = setInterval(() => {
      loadMessages().catch(console.error);
    }, 3000);

    return () => clearInterval(interval);
  }, [conversationId]);
  useEffect(() => {
  const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
    setKeyboardHeight(event.endCoordinates.height);
  });

  const hideSub = Keyboard.addListener("keyboardDidHide", () => {
    setKeyboardHeight(0);
  });

  return () => {
    showSub.remove();
    hideSub.remove();
  };
}, []);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    setText("");

    try {
      const newMessage = await messagingApi.sendMessage(conversationId, body);
      setMessages((prev) => [...prev, newMessage]);

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      Alert.alert("Message failed", error?.response?.data?.detail || "Could not send message.");
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const title = otherUser?.display_name || otherUser?.email || "Chat";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.chatHeader, { borderBottomColor: colors.cardBorder }]}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{title.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Private conversation
          </Text>
        </View>
      </View>

      <FlatList
      
        ref={listRef}
        data={messages}
          style={styles.messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMine = String(item.sender_id) === String(currentUserId);
          return (
            <View
              style={[
                styles.messageRow,
                isMine ? styles.myMessageRow : styles.theirMessageRow,
              ]}
            >
              <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
                <Text style={isMine ? styles.myMessageText : styles.theirMessageText}>
                  {item.body}
                </Text>
                <Text style={isMine ? styles.myTime : styles.theirTime}>
                  {formatTime(item.created_at)}
                </Text>
              </View>
            </View>
          );
        }}
      />


      
<View
  style={[
    styles.inputRow,
    {
      backgroundColor: colors.card,
      paddingBottom: Math.max(insets.bottom, 8),
      bottom: Platform.OS === "android" ? keyboardHeight : 0,
    },
  ]}
>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg }]}
          multiline
        />

        <TouchableOpacity
          style={[styles.sendButton, sending && { opacity: 0.6 }]}
          onPress={handleSend}
          disabled={sending}
        >
          <Text style={styles.sendText}>{sending ? "..." : "Send"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerAvatarText: { color: "#FFF", fontWeight: "800" },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  headerSubtitle: { fontSize: 12, marginTop: 2 },

  messagesList: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },

  messageRow: {
    marginBottom: 10,
    flexDirection: "row",
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  theirMessageRow: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minWidth: 70,
  },
  myBubble: {
    backgroundColor: "#4CAF50",
    borderBottomRightRadius: 5,
  },

  theirBubble: {
    backgroundColor: "#F1F1F1",
    borderBottomLeftRadius: 5,
  },

  myMessageText: {
    color: "#FFF",
    fontSize: 15,
  },
  theirMessageText: {
    color: "#222",
    fontSize: 15,
  },
  myTime: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    alignSelf: "flex-end",
    marginTop: 4,
  },
  theirTime: {
    color: "#777",
    fontSize: 11,
    alignSelf: "flex-end",
    marginTop: 4,
  },
  
inputRow: {
  position: "absolute",
  left: 0,
  right: 0,
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 12,
  paddingTop: 8,
  borderTopWidth: 1,
  borderTopColor: "#E5E5E5",
},

  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 90,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    marginLeft: 8,
  },
  sendText: {
    color: "#FFF",
    fontWeight: "800",
  },
  
messages: {
  flex: 1,
  marginBottom: 72,
},

});