import React from "react";
import { View } from "react-native";
import { useTheme } from "../../core/theme/useTheme";

/**
 * Wraps app content and applies theme background so all children re-render when theme toggles.
 */
export function ThemeRoot({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.background }}>{children}</View>;
}
