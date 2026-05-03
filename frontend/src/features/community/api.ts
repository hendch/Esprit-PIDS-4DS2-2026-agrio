import { httpClient } from '../../core/api/httpClient';

const BASE = '/api/v1/community';

export const communityApi = {
  getFeed: (params?: { category?: string; skip?: number; limit?: number }) =>
    httpClient.get(`${BASE}/feed`, { params }).then(r => r.data),

  createPost: (data: { content: string; category: string; media_url?: string }) =>
    httpClient.post(`${BASE}/posts`, data).then(r => r.data),

  deletePost: (post_id: string) =>
    httpClient.delete(`${BASE}/posts/${post_id}`),

  getComments: (post_id: string) =>
    httpClient.get(`${BASE}/posts/${post_id}/comments`).then(r => r.data),

  addComment: (post_id: string, content: string) =>
    httpClient.post(`${BASE}/posts/${post_id}/comments`, { content }).then(r => r.data),

  deleteComment: (post_id: string, comment_id: string) =>
    httpClient.delete(`${BASE}/posts/${post_id}/comments/${comment_id}`),

  toggleLike: (post_id: string) =>
    httpClient.post(`${BASE}/posts/${post_id}/like`).then(r => r.data),

  getCategories: () =>
    httpClient.get(`${BASE}/categories`).then(r => r.data),

  uploadPostImage: async (imageUri: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', { uri: imageUri, type: 'image/jpeg', name: 'post_image.jpg' } as any);
    const response = await httpClient.post('/api/v1/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.url;
  },
};
