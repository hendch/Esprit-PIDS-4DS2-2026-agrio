import { useLanguageStore } from "./languageStore";

export function useLanguage() {
  const language = useLanguageStore((s) => s.language);
  const toggleLanguage = useLanguageStore((s) => s.toggleLanguage);
  return {
    language,
    isRTL: language === "ar",
    isArabic: language === "ar",
    toggleLanguage,
  };
}