import { create } from "zustand";

type LanguageState = {
  language: "en" | "ar";
  setLanguage: (lang: "en" | "ar") => void;
  toggleLanguage: () => void;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: "en",
  setLanguage: (lang) => set({ language: lang }),
  toggleLanguage: () =>
    set((s) => ({ language: s.language === "en" ? "ar" : "en" })),
}));