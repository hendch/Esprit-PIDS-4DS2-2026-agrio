import { create } from "zustand";

type UserState = {
  displayName: string | null;
  email: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setUser: (displayName: string, email?: string) => void;
  setAuth: (params: {
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
  displayName: null,
  email: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setUser: (displayName, email) =>
    set({
      displayName,
      email: email ?? null,
    }),
  setAuth: ({ displayName, email, accessToken, refreshToken }) =>
    set({
      displayName,
      email: email ?? null,
      accessToken,
      refreshToken,
      isAuthenticated: true,
    }),
  clearUser: () =>
    set({
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
