import { create } from "zustand";

type ThemeState = {
  isDark: boolean;
  toggleDark: () => void;
  setDark: (value: boolean) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: false,
  toggleDark: () => set((s) => ({ isDark: !s.isDark })),
  setDark: (value) => set({ isDark: value }),
}));
