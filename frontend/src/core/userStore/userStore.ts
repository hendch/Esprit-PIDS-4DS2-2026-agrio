import { create } from "zustand";

type UserState = {
  displayName: string | null;
  email: string | null;
  setUser: (displayName: string, email?: string) => void;
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
  setUser: (displayName, email) =>
    set({
      displayName,
      email: email ?? null,
    }),
  clearUser: () => set({ displayName: null, email: null }),
}));

export function getDisplayNameFromEmail(email: string): string {
  return nameFromEmail(email);
}
