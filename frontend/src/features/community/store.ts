import { create } from 'zustand';
import { communityApi } from './api';
import type { Category, Comment, Post } from './types';

interface CommunityState {
  posts: Post[];
  selectedPost: Post | null;
  comments: Comment[];
  categories: Category[];
  activeCategory: string | null;
  loading: boolean;
  commentsLoading: boolean;
  submitting: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;

  fetchCategories: () => Promise<void>;
  fetchFeed: (reset?: boolean) => Promise<void>;
  loadMore: () => void;
  setCategory: (category: string | null) => void;
  selectPost: (post: Post | null) => void;
  fetchComments: (post_id: string) => Promise<void>;
  submitPost: (content: string, category: string, media_url?: string) => Promise<void>;
  submitComment: (post_id: string, content: string) => Promise<void>;
  likePost: (post_id: string) => Promise<void>;
  removePost: (post_id: string) => Promise<void>;
  removeComment: (post_id: string, comment_id: string) => Promise<void>;
  clearError: () => void;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  posts: [],
  selectedPost: null,
  comments: [],
  categories: [],
  activeCategory: null,
  loading: false,
  commentsLoading: false,
  submitting: false,
  error: null,
  hasMore: true,
  page: 0,

  fetchCategories: async () => {
    try {
      const data = await communityApi.getCategories();
      set({ categories: data });
    } catch {
      // non-critical; CATEGORY_MAP fallback used in UI
    }
  },

  fetchFeed: async (reset = false) => {
    const { loading, activeCategory, page } = get();
    if (loading && !reset) return;

    const currentPage = reset ? 0 : page;
    set(
      reset
        ? { loading: true, error: null, posts: [], page: 0, hasMore: true }
        : { loading: true },
    );

    try {
      const params: Record<string, any> = { skip: currentPage * 20, limit: 20 };
      if (activeCategory) params.category = activeCategory;
      const data: Post[] = await communityApi.getFeed(params);
      set((s) => ({
        posts: reset ? data : [...s.posts, ...data],
        page: currentPage + 1,
        hasMore: data.length === 20,
        loading: false,
      }));
    } catch (err: any) {
      set({
        error: err?.response?.data?.detail ?? err?.message ?? 'Failed to load feed',
        loading: false,
      });
    }
  },

  loadMore: () => {
    const { hasMore, loading } = get();
    if (!hasMore || loading) return;
    get().fetchFeed(false);
  },

  setCategory: (category) => {
    set({ activeCategory: category });
    get().fetchFeed(true);
  },

  selectPost: (post) => set({ selectedPost: post, comments: [] }),

  fetchComments: async (post_id) => {
    set({ commentsLoading: true });
    try {
      const data = await communityApi.getComments(post_id);
      set({ comments: data, commentsLoading: false });
    } catch {
      set({ commentsLoading: false });
    }
  },

  submitPost: async (content, category, media_url) => {
    set({ submitting: true, error: null });
    try {
      const post: Post = await communityApi.createPost({ content, category, media_url });
      set((s) => ({ posts: [post, ...s.posts], submitting: false }));
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Failed to create post';
      set({ error: msg, submitting: false });
      throw new Error(msg);
    }
  },

  submitComment: async (post_id, content) => {
    set({ submitting: true, error: null });
    try {
      const comment: Comment = await communityApi.addComment(post_id, content);
      set((s) => ({
        comments: [...s.comments, comment],
        posts: s.posts.map((p) =>
          p.id === post_id ? { ...p, comments_count: p.comments_count + 1 } : p,
        ),
        selectedPost:
          s.selectedPost?.id === post_id
            ? { ...s.selectedPost, comments_count: s.selectedPost.comments_count + 1 }
            : s.selectedPost,
        submitting: false,
      }));
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Failed to add comment';
      set({ error: msg, submitting: false });
      throw new Error(msg);
    }
  },

  likePost: async (post_id) => {
    const original =
      get().posts.find((p) => p.id === post_id) ?? get().selectedPost ?? null;
    if (!original) return;

    const toggle = (p: Post): Post =>
      p.id === post_id
        ? {
            ...p,
            liked_by_me: !p.liked_by_me,
            likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1,
          }
        : p;

    set((s) => ({
      posts: s.posts.map(toggle),
      selectedPost: s.selectedPost?.id === post_id ? toggle(s.selectedPost) : s.selectedPost,
    }));

    try {
      const result: { liked: boolean; likes_count: number } = await communityApi.toggleLike(post_id);
      const reconcile = (p: Post): Post =>
        p.id === post_id ? { ...p, liked_by_me: result.liked, likes_count: result.likes_count } : p;
      set((s) => ({
        posts: s.posts.map(reconcile),
        selectedPost:
          s.selectedPost?.id === post_id
            ? { ...s.selectedPost, liked_by_me: result.liked, likes_count: result.likes_count }
            : s.selectedPost,
      }));
    } catch {
      const revert = (p: Post): Post => (p.id === post_id ? original : p);
      set((s) => ({
        posts: s.posts.map(revert),
        selectedPost: s.selectedPost?.id === post_id ? original : s.selectedPost,
      }));
    }
  },

  removePost: async (post_id) => {
    try {
      await communityApi.deletePost(post_id);
      set((s) => ({ posts: s.posts.filter((p) => p.id !== post_id) }));
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to delete post' });
    }
  },

  removeComment: async (post_id, comment_id) => {
    try {
      await communityApi.deleteComment(post_id, comment_id);
      set((s) => ({
        comments: s.comments.filter((c) => c.id !== comment_id),
        posts: s.posts.map((p) =>
          p.id === post_id ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p,
        ),
        selectedPost:
          s.selectedPost?.id === post_id
            ? { ...s.selectedPost, comments_count: Math.max(0, s.selectedPost.comments_count - 1) }
            : s.selectedPost,
      }));
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to delete comment' });
    }
  },

  clearError: () => set({ error: null }),
}));
