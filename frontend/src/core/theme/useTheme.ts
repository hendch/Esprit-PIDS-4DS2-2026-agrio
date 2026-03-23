import { useThemeStore } from "./themeStore";
import { lightColors, darkColors, type ThemeColors } from "./themeColors";

export function useTheme(): { isDark: boolean; colors: ThemeColors } {
  const isDark = useThemeStore((s) => s.isDark);
  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
  };
}
