import { create } from 'zustand';
import { getTutorialProgress, completeStep, skipTutorial, resetTutorial } from './api';
import { TUTORIAL_STEPS } from './types';
import type { TutorialProgress, TutorialStep } from './types';

interface TutorialState {
  progress: TutorialProgress | null;
  currentStep: TutorialStep | null;
  isVisible: boolean;
  isLoading: boolean;

  loadProgress: () => Promise<void>;
  markStepComplete: (step_key: string) => Promise<void>;
  checkAndAdvance: (step_key: string) => void;
  skip: () => Promise<void>;
  reset: () => Promise<void>;
  dismiss: () => void;
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  progress: null,
  currentStep: null,
  isVisible: false,
  isLoading: false,

  loadProgress: async () => {
    set({ isLoading: true });
    try {
      const progress = await getTutorialProgress();
      if (!progress.is_completed) {
        const skippedToday = progress.skipped_at
          ? new Date(progress.skipped_at).toDateString() === new Date().toDateString()
          : false;
        if (!skippedToday) {
          const step = TUTORIAL_STEPS.find(s => s.key === progress.next_step) ?? null;
          set({ progress, currentStep: step, isVisible: true, isLoading: false });
          return;
        }
      }
      set({ progress, isVisible: false, currentStep: null, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  markStepComplete: async (step_key: string) => {
    try {
      const progress = await completeStep(step_key);
      if (progress.is_completed) {
        // All steps done — show completion modal
        set({ progress, currentStep: null, isVisible: true });
      } else {
        const nextStep = TUTORIAL_STEPS.find(s => s.key === progress.next_step) ?? null;
        set({ progress, currentStep: nextStep });
      }
    } catch {
      // network error — dismiss silently
      set({ isVisible: false });
    }
  },

  skip: async () => {
    try {
      await skipTutorial();
    } catch {
      // ignore
    }
    set({ isVisible: false });
  },

  reset: async () => {
    try {
      const progress = await resetTutorial();
      const firstStep = TUTORIAL_STEPS.find(s => s.key === progress.next_step) ?? TUTORIAL_STEPS[0];
      set({ progress, currentStep: firstStep, isVisible: true });
    } catch {
      // ignore
    }
  },

  checkAndAdvance: (step_key: string) => {
    const { currentStep, isVisible } = get();
    if (currentStep?.key === step_key && isVisible) {
      get().markStepComplete(step_key);
    }
  },

  dismiss: () => set({ isVisible: false }),
}));
