import React, { useEffect } from "react";
import { View, StatusBar } from "react-native";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { useTheme } from "./core/theme/useTheme";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./core/navigation/RootNavigator";
import { AppBootstrap } from "./bootstrap/AppBootstrap";
import { AppDrawer } from "./shared/components/AppDrawer";
import { ThemeRoot } from "./shared/components/ThemeRoot";
import { useUserStore } from "./core/userStore/userStore";
import { useTutorialStore } from "./core/tutorial/store";
import { TUTORIAL_STEPS } from "./core/tutorial/types";
import { useGamificationStore } from "./features/gamification/store";
import { TutorialTooltip } from "./core/tutorial/TutorialTooltip";
import { TutorialCompletion } from "./core/tutorial/TutorialCompletion";

function AppContent() {
  const { isDark } = useTheme();
  const nav = useNavigation<any>();
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const tutorial = useTutorialStore();

  // Load tutorial progress + award daily login once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      tutorial.loadProgress();
      useGamificationStore.getState().awardDailyLogin();
    }
  }, [isAuthenticated]);

  // Navigate to the correct screen whenever the active step changes
  useEffect(() => {
    if (tutorial.currentStep && tutorial.isVisible) {
      nav.navigate(tutorial.currentStep.screen as any);
    }
  }, [tutorial.currentStep, tutorial.isVisible]);

  const stepIndex = tutorial.currentStep
    ? TUTORIAL_STEPS.findIndex(s => s.key === tutorial.currentStep!.key)
    : -1;

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <ThemeRoot>
        <View style={{ flex: 1 }}>
          <RootNavigator />
          {isAuthenticated ? <AppDrawer /> : null}
          {/* Floating tooltip card — pointerEvents="box-none" lets touches reach the screen */}
          {isAuthenticated && tutorial.isVisible && tutorial.currentStep && !tutorial.progress?.is_completed && (
            <TutorialTooltip
              step={tutorial.currentStep}
              stepNumber={stepIndex + 1}
              totalSteps={TUTORIAL_STEPS.length}
              onSkip={tutorial.skip}
            />
          )}
        </View>
      </ThemeRoot>

      {/* Completion celebration modal — proper Modal, renders after tutorial finishes */}
      {isAuthenticated && tutorial.isVisible && tutorial.progress?.is_completed && (
        <TutorialCompletion onClose={tutorial.dismiss} />
      )}
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
