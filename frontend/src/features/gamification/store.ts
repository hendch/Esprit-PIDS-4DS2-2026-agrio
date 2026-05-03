import { create } from 'zustand';
import * as gamificationApi from './api';
import type { GamificationDashboard, LeaderboardEntry } from './types';

interface GamificationState {
  dashboard: GamificationDashboard | null;
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  error: string | null;

  fetchDashboard: () => Promise<void>;
  awardDailyLogin: () => Promise<void>;
  completeTask: (task_key: string) => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
  dashboard: null,
  leaderboard: [],
  loading: false,
  error: null,

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
      await gamificationApi.awardLogin();
      // Refresh dashboard to get updated balance
      await get().fetchDashboard();
    } catch {
      // Not a verified farmer or network error — silent
    }
  },

  completeTask: async (task_key: string) => {
    try {
      const result = await gamificationApi.completeTask(task_key);
      // Patch dashboard state with updated balance and mark task completed
      set(state => {
        if (!state.dashboard) return {};
        return {
          dashboard: {
            ...state.dashboard,
            balance: result.new_balance,
            tasks: state.dashboard.tasks.map(t =>
              t.key === task_key ? { ...t, completed: true } : t,
            ),
          },
        };
      });
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
