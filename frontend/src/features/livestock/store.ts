import { create } from 'zustand';
import { livestockApi } from './api';
import type { Animal, AnimalCreate, AnimalPnL, HealthEvent, HerdStats, MarketPrice } from './types';

interface LivestockState {
  farmId: string | null;
  animals: Animal[];
  selectedAnimal: Animal | null;
  healthEvents: HealthEvent[];
  marketPrice: MarketPrice | null;
  pnl: AnimalPnL | null;
  pnlLoading: boolean;
  herdStats: HerdStats | null;
  statsLoading: boolean;
  loading: boolean;
  submitting: boolean;
  error: string | null;

  setFarmId: (farmId: string) => void;
  resolveFarmId: () => Promise<void>;
  fetchAnimals: () => Promise<void>;
  selectAnimal: (animal: Animal | null) => void;
  fetchAnimalDetail: (id: string) => Promise<void>;
  fetchHealthEvents: (id: string) => Promise<void>;
  fetchMarketPrice: (id: string) => Promise<void>;
  fetchPnL: (animal_id: string, farm_id: string) => Promise<void>;
  fetchHerdStats: (farm_id: string) => Promise<void>;
  addAnimal: (data: AnimalCreate) => Promise<void>;
  editAnimal: (id: string, data: Partial<AnimalCreate>) => Promise<void>;
  removeAnimal: (id: string) => Promise<void>;
  addHealthEvent: (animal_id: string, farm_id: string, data: object) => Promise<void>;
  removeHealthEvent: (animal_id: string, event_id: string, farm_id: string) => Promise<void>;
  clearError: () => void;
}

export const useLivestockStore = create<LivestockState>((set, get) => ({
  farmId: null,
  animals: [],
  selectedAnimal: null,
  healthEvents: [],
  marketPrice: null,
  pnl: null,
  pnlLoading: false,
  herdStats: null,
  statsLoading: false,
  loading: false,
  submitting: false,
  error: null,

  setFarmId: (farmId) => set({ farmId }),

  resolveFarmId: async () => {
    if (get().farmId) return;
    try {
      const { farm_id } = await livestockApi.getMyFarm();
      set({ farmId: farm_id });
    } catch {
      // farm_id remains null; UI shows empty state
    }
  },

  fetchAnimals: async () => {
    const { farmId } = get();
    if (!farmId) return;
    set({ loading: true, error: null });
    try {
      const data = await livestockApi.getAnimals(farmId);
      set({ animals: data, loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to load animals', loading: false });
    }
  },

  selectAnimal: (animal) => set({ selectedAnimal: animal, healthEvents: [], marketPrice: null, pnl: null, pnlLoading: false }),

  fetchAnimalDetail: async (id) => {
    const { farmId } = get();
    if (!farmId) return;
    set({ loading: true, error: null });
    try {
      const animal = await livestockApi.getAnimal(id, farmId);
      set({ selectedAnimal: animal, healthEvents: animal.health_events ?? [], loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to load animal', loading: false });
    }
  },

  fetchHealthEvents: async (id) => {
    const { farmId } = get();
    if (!farmId) return;
    set({ loading: true });
    try {
      const data = await livestockApi.getHealthEvents(id, farmId);
      set({ healthEvents: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchMarketPrice: async (id) => {
    const { farmId } = get();
    if (!farmId) return;
    set({ marketPrice: null });
    try {
      const data = await livestockApi.getMarketPrice(id, farmId);
      set({ marketPrice: data });
    } catch {
      set({ marketPrice: null });
    }
  },

  fetchPnL: async (animal_id, farm_id) => {
    set({ pnlLoading: true, pnl: null });
    try {
      const data = await livestockApi.getPnL(animal_id, farm_id);
      set({ pnl: data, pnlLoading: false });
    } catch {
      set({ pnl: null, pnlLoading: false });
    }
  },

  fetchHerdStats: async (farm_id) => {
    set({ statsLoading: true });
    try {
      const stats = await livestockApi.getHerdStats(farm_id);
      set({ herdStats: stats });
    } finally {
      set({ statsLoading: false });
    }
  },

  addAnimal: async (data) => {
    set({ submitting: true, error: null });
    try {
      const animal = await livestockApi.createAnimal(data);
      set((s) => ({ animals: [animal, ...s.animals], submitting: false }));
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Failed to create animal';
      set({ error: msg, submitting: false });
      throw new Error(msg);
    }
  },

  editAnimal: async (id, data) => {
    const { farmId } = get();
    if (!farmId) return;
    set({ submitting: true, error: null });
    try {
      const updated = await livestockApi.updateAnimal(id, farmId, data);
      set((s) => ({
        animals: s.animals.map((a) => (a.id === id ? updated : a)),
        selectedAnimal: s.selectedAnimal?.id === id ? updated : s.selectedAnimal,
        submitting: false,
      }));
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Failed to update animal';
      set({ error: msg, submitting: false });
      throw new Error(msg);
    }
  },

  removeAnimal: async (id) => {
    const { farmId } = get();
    if (!farmId) return;
    try {
      await livestockApi.deleteAnimal(id, farmId);
      set((s) => ({
        animals: s.animals.filter((a) => a.id !== id),
        selectedAnimal: s.selectedAnimal?.id === id ? null : s.selectedAnimal,
      }));
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to delete animal' });
    }
  },

  addHealthEvent: async (animal_id, farm_id, data) => {
    set({ submitting: true, error: null });
    try {
      const event = await livestockApi.addHealthEvent(animal_id, farm_id, data);
      set((s) => ({ healthEvents: [event, ...s.healthEvents], submitting: false }));
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Failed to add event';
      set({ error: msg, submitting: false });
      throw new Error(msg);
    }
  },

  removeHealthEvent: async (animal_id, event_id, farm_id) => {
    try {
      await livestockApi.deleteHealthEvent(animal_id, event_id, farm_id);
      set((s) => ({ healthEvents: s.healthEvents.filter((e) => e.id !== event_id) }));
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to delete event' });
    }
  },

  clearError: () => set({ error: null }),
}));
