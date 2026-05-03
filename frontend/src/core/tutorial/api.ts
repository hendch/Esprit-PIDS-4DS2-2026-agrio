import { httpClient } from '../api/httpClient';
import type { TutorialProgress } from './types';

export const getTutorialProgress = (): Promise<TutorialProgress> =>
  httpClient.get('/api/v1/tutorial/progress').then(r => r.data);

export const completeStep = (step_key: string): Promise<TutorialProgress> =>
  httpClient.post(`/api/v1/tutorial/step/${step_key}`).then(r => r.data);

export const skipTutorial = (): Promise<void> =>
  httpClient.post('/api/v1/tutorial/skip').then(r => r.data);

export const resetTutorial = (): Promise<TutorialProgress> =>
  httpClient.post('/api/v1/tutorial/reset').then(r => r.data);
