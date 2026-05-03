import { create } from 'zustand';
import * as profileApi from './api';
import type { UserProfile } from './types';

interface ProfileState {
  profile: UserProfile | null;
  loading: boolean;
  saving: boolean;
  error: string | null;

  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  uploadAvatar: (imageUri: string) => Promise<void>;
  clearError: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loading: false,
  saving: false,
  error: null,

  fetchProfile: async () => {
    set({ loading: true, error: null });
    try {
      const profile = await profileApi.getProfile();
      set({ profile, loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to load profile', loading: false });
    }
  },

  updateProfile: async (data) => {
    set({ saving: true, error: null });
    try {
      const profile = await profileApi.updateProfile(data);
      set({ profile, saving: false });
    } catch (err: any) {
      set({ error: err?.response?.data?.detail ?? err?.message ?? 'Failed to save profile', saving: false });
      throw err;
    }
  },

  uploadAvatar: async (imageUri) => {
    set({ saving: true, error: null });
    try {
      const profile = await profileApi.uploadAvatar(imageUri);
      set({ profile, saving: false });
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to upload photo', saving: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
