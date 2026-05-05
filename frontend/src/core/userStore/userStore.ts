import { create } from "zustand";

type UserState = {
  id: string | null;
  displayName: string | null;
  email: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setTokens: (params: {
    accessToken: string;
    refreshToken: string;
  }) => void;
  setUser: (displayName: string, email?: string) => void;
  setAuth: (params: {
    id: string;
    displayName: string;
    email?: string;
    accessToken: string;
    refreshToken: string;
  }) => void;
  clearUser: () => void;
};

function nameFromEmail(email: string): string {
  const part = email.trim().split("@")[0];
  if (!part) return "User";
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

export const useUserStore = create<UserState>((set) => ({
  id: null,
  displayName: null,
  email: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setTokens: ({ accessToken, refreshToken }) =>
  set({
    accessToken,
    refreshToken,
  }),
  setUser: (displayName, email) =>
    set({
      displayName,
      email: email ?? null,
    }),
  setAuth: ({ id, displayName, email, accessToken, refreshToken }) =>
    set({
      id,
      displayName,
      email: email ?? null,
      accessToken,
      refreshToken,
      isAuthenticated: true,
    }),
  clearUser: () =>
    set({
      id: null,
      displayName: null,
      email: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    }),
}));

export function getDisplayNameFromEmail(email: string): string {
  return nameFromEmail(email);
}
