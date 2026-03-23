import React from "react";
import { View, StatusBar } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useTheme } from "./core/theme/useTheme";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./core/navigation/RootNavigator";
import { AppBootstrap } from "./bootstrap/AppBootstrap";
import { AppDrawer } from "./shared/components/AppDrawer";
import { ThemeRoot } from "./shared/components/ThemeRoot";

function AppContent() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <ThemeRoot>
        <View style={{ flex: 1 }}>
          <RootNavigator />
          <AppDrawer />
        </View>
      </ThemeRoot>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppBootstrap>
        <NavigationContainer>
          <AppContent />
        </NavigationContainer>
      </AppBootstrap>
    </SafeAreaProvider>
  );
}
