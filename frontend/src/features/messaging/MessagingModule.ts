import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { MessagesScreen } from "./screens/MessagesScreen";
import { UserSearchScreen } from "./screens/UserSearchScreen";
import { ChatScreen } from "./screens/ChatScreen";

export const messagingModule: FeatureModule = {
  id: "messaging",
  routes: [
    {
      name: Routes.Messages,
      component: MessagesScreen,
      options: { title: "Farmer Connect" },
    },
    {
      name: Routes.UserSearch,
      component: UserSearchScreen,
      options: { title: "Find Users" },
    },
    {
      name: Routes.Chat,
      component: ChatScreen,
      options: { title: "Chat" },
    },
  ],
  dashboardEntry: {
    title: "Farmer Connect",
    subtitle: "Private messages with other Agrio users",
    routeName: Routes.Messages,
    emoji: "💬",
  },
};