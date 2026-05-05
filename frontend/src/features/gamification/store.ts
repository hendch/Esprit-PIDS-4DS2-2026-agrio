import { create } from 'zustand';
import * as gamificationApi from './api';
import type { GamificationDashboard, LeaderboardEntry } from './types';

const TASK_LABELS: Record<string, string> = {
  check_market_prices: 'Checked market prices',
  check_herd_stats:    'Checked herd stats',
  generate_forecast:   'Generated a forecast',
  post_or_comment:     'Engaged in community',
  record_health_event: 'Recorded health event',
  check_irrigation:    'Evaluated irrigation field',
};

interface GamificationState {
  dashboard: GamificationDashboard | null;
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  toast: { amount: number; reason: string } | null;

  fetchDashboard: () => Promise<void>;
  awardDailyLogin: () => Promise<void>;
  completeTask: (task_key: string) => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
  showToast: (amount: number, reason: string) => void;
  hideToast: () => void;
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
  dashboard: null,
  leaderboard: [],
  loading: false,
  error: null,
  toast: null,

  showToast: (amount, reason) => set({ toast: { amount, reason } }),
  hideToast: () => set({ toast: null }),

  fetchDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const dashboard = await gamificationApi.getDashboard();
      set({ dashboard, loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to load dashboard', loading: false });
    }
  },

  awardDailyLogin: async () => {
    try {
      const result = await gamificationApi.awardLogin();
      if (result.coins_earned > 0) {
        get().showToast(result.coins_earned, `🔥 Day ${result.streak} login streak!`);
      }
      set(state => ({
        dashboard: state.dashboard
          ? { ...state.dashboard, balance: result.new_balance, login_streak: result.streak }
          : null,
      }));
    } catch {
      // Not a verified farmer or network error — silent
    }
  },

  completeTask: async (task_key: string) => {
    try {
      const result = await gamificationApi.completeTask(task_key);
      get().showToast(result.coins_earned, TASK_LABELS[task_key] ?? 'Daily task complete');
      // Fetch authoritative state so any reset tasks show correctly alongside the new completion
      await get().fetchDashboard();
    } catch {
      // Already completed today (400) or not verified farmer (403) — silent
    }
  },

  fetchLeaderboard: async () => {
    set({ loading: true, error: null });
    try {
      const leaderboard = await gamificationApi.getLeaderboard();
      set({ leaderboard, loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to load leaderboard', loading: false });
    }
  },
}));
