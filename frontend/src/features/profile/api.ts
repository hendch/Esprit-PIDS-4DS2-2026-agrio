import { httpClient } from '../../core/api/httpClient';
import type { UserProfile } from './types';

export const getProfile = (): Promise<UserProfile> =>
  httpClient.get('/api/v1/auth/me').then(r => r.data);

export const updateProfile = (data: Partial<UserProfile>): Promise<UserProfile> =>
  httpClient.patch('/api/v1/auth/me', data).then(r => r.data);

export const uploadAvatar = (imageUri: string): Promise<UserProfile> => {
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'avatar.jpg',
  } as any);
  return httpClient.post('/api/v1/auth/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};
