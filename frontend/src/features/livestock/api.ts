import { httpClient } from '../../core/api/httpClient';
import type { AnimalCreate } from './types';

const BASE = '/api/v1/livestock';

export const livestockApi = {
  getMyFarm: () =>
    httpClient.get('/api/v1/auth/me/farm').then(r => r.data as { farm_id: string }),

  getAnimals: (farm_id: string) =>
    httpClient.get(`${BASE}/animals`, { params: { farm_id } }).then(r => r.data),

  getAnimal: (id: string, farm_id: string) =>
    httpClient.get(`${BASE}/animals/${id}`, { params: { farm_id } }).then(r => r.data),

  createAnimal: (data: AnimalCreate) =>
    httpClient.post(`${BASE}/animals`, data).then(r => r.data),

  updateAnimal: (id: string, farm_id: string, data: Partial<AnimalCreate>) =>
    httpClient.put(`${BASE}/animals/${id}`, data, { params: { farm_id } }).then(r => r.data),

  deleteAnimal: (id: string, farm_id: string) =>
    httpClient.delete(`${BASE}/animals/${id}`, { params: { farm_id } }),

  getHealthEvents: (animal_id: string, farm_id: string) =>
    httpClient.get(`${BASE}/animals/${animal_id}/health`, { params: { farm_id } }).then(r => r.data),

  addHealthEvent: (animal_id: string, farm_id: string, data: object) =>
    httpClient.post(`${BASE}/animals/${animal_id}/health`, data, { params: { farm_id } }).then(r => r.data),

  deleteHealthEvent: (animal_id: string, event_id: string, farm_id: string) =>
    httpClient.delete(`${BASE}/animals/${animal_id}/health/${event_id}`, { params: { farm_id } }),

  getMarketPrice: (animal_id: string, farm_id: string) =>
    httpClient.get(`${BASE}/animals/${animal_id}/market-price`, { params: { farm_id } }).then(r => r.data),

  getPnL: (animal_id: string, farm_id: string) =>
    httpClient.get(`${BASE}/animals/${animal_id}/pnl`, { params: { farm_id } }).then(r => r.data),

  getHerdStats: (farm_id: string) =>
    httpClient.get(`${BASE}/animals/stats`, { params: { farm_id } }).then(r => r.data),
};
