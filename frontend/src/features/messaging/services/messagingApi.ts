import { httpClient } from "../../../core/api/httpClient";

export type SearchUser = {
  id: string;
  email: string;
  display_name?: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: string;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  other_user: SearchUser | null;
  last_message: Message | null;
  created_at: string;
  updated_at: string;
};

export const messagingApi = {
  async searchUsers(query: string): Promise<SearchUser[]> {
    const response = await httpClient.get("/api/v1/messaging/users/search", {
      params: { q: query },
    });
    return response.data;
  },

  async createOrGetDirectConversation(otherUserId: string): Promise<Conversation> {
    const response = await httpClient.post(
      `/api/v1/messaging/conversations/direct/${otherUserId}`,
    );
    return response.data;
  },

  async getConversations(): Promise<Conversation[]> {
    const response = await httpClient.get("/api/v1/messaging/conversations");
    return response.data;
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const response = await httpClient.get(
      `/api/v1/messaging/conversations/${conversationId}/messages`,
    );
    return response.data;
  },

  async sendMessage(conversationId: string, body: string): Promise<Message> {
    const response = await httpClient.post(
      `/api/v1/messaging/conversations/${conversationId}/messages`,
      { body },
    );
    return response.data;
  },
};