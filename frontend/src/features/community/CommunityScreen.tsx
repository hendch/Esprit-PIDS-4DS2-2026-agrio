import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { Routes } from '../../core/navigation/routes';
import { useDrawerStore } from '../../core/drawer/drawerStore';
import { useTheme } from '../../core/theme/useTheme';
import { communityApi } from './api';
import { useCommunityStore } from './store';
import type { Comment, Post } from './types';
import { CATEGORY_MAP } from './types';
import { useGamificationStore } from '../gamification/store';
import { useProfileStore } from '../profile/store';
import type { LeaderboardEntry } from '../gamification/types';

// ─── constants ──────────────────────────────────────────────────────────────

const GREEN = '#4CAF50';
const GREEN_LIGHT = '#E8F5E9';
const OFFSET_WHITE = '#FAFAF8';

const CATEGORY_BG: Record<string, string> = {
  price_talk: '#FFF3E0',
  livestock_advice: '#E8F5E9',
  crop_disease: '#F3E5F5',
  irrigation: '#E3F2FD',
  buy_sell: '#FFF8E1',
  general: '#F5F5F5',
};

const AVATAR_PALETTE = ['#B3E5FC', '#C8E6C9', '#FFF9C4', '#FFCCBC', '#E1BEE7', '#B2EBF2'];

// ─── helpers ─────────────────────────────────────────────────────────────────

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const avatarColor = (name: string): string => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
};

const initial = (name: string) => (name?.[0] ?? '?').toUpperCase();

// ─── TabBar ───────────────────────────────────────────────────────────────────

function TabBar({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabs = [
    { key: 'Home', icon: '🏠', route: Routes.Dashboard },
    { key: 'Land', icon: '🗺️', route: Routes.Satellite },
    { key: 'Crop', icon: '🌱', route: Routes.DiseaseDetection },
    { key: 'Water', icon: '💧', route: Routes.Irrigation },
    { key: 'Livestock', icon: '🐄', route: Routes.Livestock },
    { key: 'Prices', icon: '📈', route: Routes.MarketPrices },
    { key: 'Community', icon: '👥', route: Routes.Community },
    { key: 'Alerts', icon: '🔔', route: Routes.Alerts },
  ];
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 8 }]}>
      {tabs.map((t) => (
        <Pressable key={t.key} onPress={() => nav.navigate(t.route)} style={styles.tabItem}>
          <View style={[styles.tabIconWrap, active === t.key && styles.tabIconWrapActive]}>
            <Text style={styles.tabIcon}>{t.icon}</Text>
          </View>
          <Text style={[styles.tabLabel, active === t.key && styles.tabLabelActive]}>{t.key}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: Post;
  onPress: () => void;
  onLike: () => void;
  onDelete: () => void;
  truncate?: boolean;
}

function PostCard({ post, onPress, onLike, onDelete, truncate = true }: PostCardProps) {
  const cat = CATEGORY_MAP[post.category];
  const bg = CATEGORY_BG[post.category] ?? '#F5F5F5';
  const isLong = post.content.length > 140;

  return (
    <Pressable style={styles.postCard} onPress={onPress}>
      {/* header row */}
      <View style={styles.postHeader}>
        {post.user_avatar_url ? (
          <Image source={{ uri: post.user_avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: avatarColor(post.user_display_name) }]}>
            <Text style={styles.avatarText}>{initial(post.user_display_name)}</Text>
          </View>
        )}
        <View style={styles.postMeta}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.postAuthor}>{post.user_display_name}</Text>
              {post.user_is_verified_farmer && (
                <Text style={{ fontSize: 12, color: '#F59E0B' }}>🏅</Text>
              )}
            </View>
          <View style={[styles.catPill, { backgroundColor: bg }]}>
            <Text style={styles.catPillText}>
              {cat?.emoji ?? ''} {cat?.label ?? post.category}
            </Text>
          </View>
        </View>
        <View style={styles.postRight}>
          <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
          {post.is_mine && (
            <Pressable
              style={styles.moreBtn}
              onPress={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              hitSlop={8}
            >
              <Text style={styles.moreBtnText}>⋯</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* content */}
      <Text
        style={styles.postContent}
        numberOfLines={truncate ? 3 : undefined}
      >
        {post.content}
      </Text>
      {truncate && isLong && (
        <Text style={styles.readMore}>read more</Text>
      )}

      {/* media */}
      {post.media_url ? (
        <Image source={{ uri: post.media_url }} style={styles.postMedia} resizeMode="cover" />
      ) : null}

      {/* action row */}
      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionBtn}
          onPress={(e) => {
            e.stopPropagation();
            onLike();
          }}
          hitSlop={8}
        >
          <Text style={[styles.actionIcon, post.liked_by_me && styles.actionIconLiked]}>
            {post.liked_by_me ? '👍' : '👍'}
          </Text>
          <Text style={[styles.actionCount, post.liked_by_me && styles.actionCountLiked]}>
            {post.likes_count}
          </Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onPress} hitSlop={8}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{post.comments_count}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── CommentRow ───────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  onDelete,
}: {
  comment: Comment;
  onDelete: () => void;
}) {
  return (
    <Pressable
      style={styles.commentRow}
      onLongPress={comment.is_mine ? onDelete : undefined}
      delayLongPress={400}
    >
      <View style={styles.commentTop}>
        {comment.user_avatar_url ? (
          <Image source={{ uri: comment.user_avatar_url }} style={styles.avatarSm} />
        ) : (
          <View style={[styles.avatarSm, { backgroundColor: avatarColor(comment.user_display_name) }]}>
            <Text style={styles.avatarSmText}>{initial(comment.user_display_name)}</Text>
          </View>
        )}
        <Text style={styles.commentAuthor}>{comment.user_display_name}</Text>
        <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
      </View>
      <Text style={styles.commentContent}>{comment.content}</Text>
    </Pressable>
  );
}

// ─── CommunityScreen ──────────────────────────────────────────────────────────

export function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const store = useCommunityStore();
  const gamification = useGamificationStore();
  const { profile } = useProfileStore();
  const {
    posts,
    selectedPost,
    comments,
    categories,
    activeCategory,
    loading,
    commentsLoading,
    submitting,
    page,
  } = store;

  const [view, setView] = useState<'feed' | 'post_detail'>('feed');
  const [activeTab, setActiveTab] = useState<'feed' | 'leaderboard'>('feed');
  const [showModal, setShowModal] = useState(false);

  // new-post form
  const [postContent, setPostContent] = useState('');
  const [postCategory, setPostCategory] = useState<string | null>(null);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);

  // comment input
  const [commentText, setCommentText] = useState('');
  const commentInputRef = useRef<TextInput>(null);

  const displayCategories =
    categories.length > 0
      ? categories
      : Object.entries(CATEGORY_MAP).map(([key, val]) => ({ key, ...val }));

  useEffect(() => {
    store.fetchCategories();
    store.fetchFeed(true);
  }, []);

  useEffect(() => {
    if (activeTab === 'leaderboard') gamification.fetchLeaderboard();
  }, [activeTab]);


  // ── navigation helpers ──────────────────────────────────────────────────────

  const openPostDetail = useCallback(
    (post: Post) => {
      store.selectPost(post);
      store.fetchComments(post.id);
      setView('post_detail');
    },
    [store],
  );

  const handleBack = () => {
    setView('feed');
    store.selectPost(null);
    setCommentText('');
  };

  // ── post actions ────────────────────────────────────────────────────────────

  const confirmDeletePost = (post_id: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          store.removePost(post_id);
          if (view === 'post_detail') handleBack();
        },
      },
    ]);
  };

  const confirmDeleteComment = (post_id: string, comment_id: string) => {
    Alert.alert('Delete Comment', 'Delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => store.removeComment(post_id, comment_id),
      },
    ]);
  };

  // ── new post modal ──────────────────────────────────────────────────────────

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow Agrio to access your photos to add images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPickedImageUri(result.assets[0].uri);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setPostContent('');
    setPostCategory(null);
    setPickedImageUri(null);
  };

  const handleSubmitPost = async () => {
    if (!postContent.trim() || !postCategory) return;
    let mediaUrl: string | undefined;
    if (pickedImageUri) {
      try {
        mediaUrl = await communityApi.uploadPostImage(pickedImageUri);
      } catch {
        Alert.alert('Upload failed', 'Could not upload image. Try posting without a photo?');
        return;
      }
    }
    try {
      await store.submitPost(postContent.trim(), postCategory, mediaUrl);
      closeModal();
    } catch {
      // error visible in store.error; Alert shown below
      Alert.alert('Error', store.error ?? 'Could not create post.');
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !selectedPost) return;
    const text = commentText.trim();
    setCommentText('');
    try {
      await store.submitComment(selectedPost.id, text);
    } catch {
      setCommentText(text);
    }
  };

  // ── render: leaderboard ─────────────────────────────────────────────────────

  const renderLeaderboard = () => {
    const RANK_STYLES: Record<number, { bg: string; emoji: string; color: string }> = {
      1: { bg: '#FEF3C7', emoji: '🥇', color: '#D97706' },
      2: { bg: '#F3F4F6', emoji: '🥈', color: '#6B7280' },
      3: { bg: '#FEF9EE', emoji: '🥉', color: '#B45309' },
    };

    const renderEntry = ({ item }: { item: LeaderboardEntry }) => {
      const rankStyle = RANK_STYLES[item.rank];
      const isMe = item.user_id === profile?.id;
      const initials = (item.display_name ?? '?').slice(0, 2).toUpperCase();

      return (
        <View style={[
          styles.lbRow,
          rankStyle && { backgroundColor: rankStyle.bg },
          isMe && styles.lbRowMe,
        ]}>
          <Text style={[styles.lbRank, rankStyle && { color: rankStyle.color }]}>
            {rankStyle ? rankStyle.emoji : `#${item.rank}`}
          </Text>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.lbAvatar} />
          ) : (
            <View style={[styles.lbAvatar, { backgroundColor: avatarColor(item.display_name ?? '?'), alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#37474F' }}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.lbName}>{item.display_name ?? 'Farmer'}</Text>
              {item.is_verified_farmer && <Text style={{ fontSize: 12 }}>🏅</Text>}
            </View>
            <Text style={styles.lbStreak}>🔥 {item.login_streak} day streak</Text>
          </View>
          <Text style={styles.lbCoins}>🪙 {item.total_earned}</Text>
        </View>
      );
    };

    return (
      <FlatList
        data={gamification.leaderboard}
        keyExtractor={(item) => item.user_id}
        renderItem={renderEntry}
        ListHeaderComponent={
          <View style={styles.lbHeader}>
            <Text style={styles.lbTitle}>🏆 Top Farmers</Text>
            <Text style={styles.lbSubtitle}>Ranked by total coins earned</Text>
          </View>
        }
        ListEmptyComponent={
          gamification.loading ? (
            <ActivityIndicator color={GREEN} style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🏆</Text>
              <Text style={styles.emptyTitle}>No verified farmers yet</Text>
              <Text style={styles.emptySubtitle}>
                Complete your profile and tutorial to join the leaderboard!
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 80 + 24 }}
      />
    );
  };

  // ── render: feed ────────────────────────────────────────────────────────────

  const renderFeed = () => (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.headerBorder },
        ]}
      >
        <TouchableOpacity onPress={() => useDrawerStore.getState().openDrawer()}>
          <Text style={styles.hamburger}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>Agrio</Text>
        </View>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSubtitle}>المجتمع</Text>
        </View>
        <Pressable onPress={() => setShowModal(true)} hitSlop={8} style={styles.composeBtn}>
          <Text style={styles.composeBtnText}>✏️</Text>
        </Pressable>
      </View>

      {/* Feed / Leaderboard tab switcher */}
      <View style={styles.tabSwitcher}>
        <Pressable
          style={[styles.tabSwitchBtn, activeTab === 'feed' && styles.tabSwitchBtnActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabSwitchText, activeTab === 'feed' && styles.tabSwitchTextActive]}>
            📰 Feed
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabSwitchBtn, activeTab === 'leaderboard' && styles.tabSwitchBtnActive]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Text style={[styles.tabSwitchText, activeTab === 'leaderboard' && styles.tabSwitchTextActive]}>
            🏆 Leaderboard
          </Text>
        </Pressable>
      </View>

      {activeTab === 'leaderboard' ? renderLeaderboard() : (
        <>
          {/* category filter bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterBar}
            contentContainerStyle={styles.filterBarContent}
          >
            <Pressable
              style={[styles.chip, activeCategory === null && styles.chipActive]}
              onPress={() => store.setCategory(null)}
            >
              <View style={styles.chipInner}>
                <Text style={styles.chipEmoji}>🌍</Text>
                <Text style={[styles.chipText, activeCategory === null && styles.chipTextActive]}>
                  {' '}All
                </Text>
              </View>
            </Pressable>
            {displayCategories.map((cat) => (
              <Pressable
                key={cat.key}
                style={[styles.chip, activeCategory === cat.key && styles.chipActive]}
                onPress={() => store.setCategory(cat.key)}
              >
                <View style={styles.chipInner}>
                  <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.chipText, activeCategory === cat.key && styles.chipTextActive]}>
                    {' '}{cat.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {/* post list */}
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PostCard
                post={item}
                onPress={() => openPostDetail(item)}
                onLike={() => store.likePost(item.id)}
                onDelete={() => confirmDeletePost(item.id)}
                truncate
              />
            )}
            onEndReached={store.loadMore}
            onEndReachedThreshold={0.3}
            onRefresh={() => store.fetchFeed(true)}
            refreshing={loading && page === 0}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator color={GREEN} style={{ marginTop: 60 }} />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text style={styles.emptyTitle}>No posts yet in this category</Text>
                  <Text style={styles.emptySubtitle}>
                    Be the first to share something with the community
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              loading && page > 0 ? (
                <ActivityIndicator color={GREEN} style={{ marginVertical: 16 }} />
              ) : null
            }
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 + 24 }}
          />
        </>
      )}

      {/* post list */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => openPostDetail(item)}
            onLike={() => store.likePost(item.id)}
            onDelete={() => confirmDeletePost(item.id)}
            truncate
          />
        )}
        onEndReached={store.loadMore}
        onEndReachedThreshold={0.3}
        onRefresh={() => store.fetchFeed(true)}
        refreshing={loading && page === 0}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={GREEN} style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyTitle}>No posts yet in this category</Text>
              <Text style={styles.emptySubtitle}>
                Be the first to share something with the community
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loading && page > 0 ? (
            <ActivityIndicator color={GREEN} style={{ marginVertical: 16 }} />
          ) : null
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 + 24 }}
      />

      <TabBar active="Community" />
    </View>
  );

  // ── render: post detail ─────────────────────────────────────────────────────

  const renderDetail = () => {
    if (!selectedPost) return null;
    const post = selectedPost;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* detail header */}
        <View
          style={[
            styles.detailHeader,
            { paddingTop: insets.top + 4, backgroundColor: colors.background, borderBottomColor: colors.headerBorder },
          ]}
        >
          <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>
          <Text style={styles.detailHeaderTitle} numberOfLines={1}>
            Post
          </Text>
          <View style={{ width: 64 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* comments + post list */}
          <FlatList
            style={{ flex: 1 }}
            data={comments}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                onDelete={() => confirmDeleteComment(post.id, item.id)}
              />
            )}
            ListHeaderComponent={
              <>
                {/* full post card */}
                <PostCard
                  post={post}
                  onPress={() => {}}
                  onLike={() => store.likePost(post.id)}
                  onDelete={() => confirmDeletePost(post.id)}
                  truncate={false}
                />
                {/* comments title */}
                <View style={styles.commentsHeader}>
                  <Text style={styles.commentsHeaderText}>
                    Comments ({post.comments_count})
                  </Text>
                </View>
                {commentsLoading && (
                  <ActivityIndicator color={GREEN} style={{ marginVertical: 20 }} />
                )}
              </>
            }
            ListEmptyComponent={
              commentsLoading ? null : (
                <View style={styles.emptyComments}>
                  <Text style={styles.emptyCommentsText}>
                    No comments yet. Be the first to reply.
                  </Text>
                </View>
              )
            }
            contentContainerStyle={{ paddingBottom: 8 }}
          />

          {/* comment input bar */}
          <View style={[styles.commentBar, { paddingBottom: insets.bottom || 8 }]}>
            <TextInput
              ref={commentInputRef}
              style={styles.commentInput}
              placeholder="Write a comment..."
              placeholderTextColor="#999"
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSubmitComment}
              blurOnSubmit={false}
            />
            <Pressable
              style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
              onPress={handleSubmitComment}
              disabled={!commentText.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendBtnText}>↑</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  };

  // ── render: new post modal ──────────────────────────────────────────────────

  const renderModal = () => (
    <>
      <Pressable style={styles.backdrop} onPress={closeModal} />
      <KeyboardAvoidingView behavior="padding" style={styles.sheetWrapper}>
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.modalHandle} />

          {/* modal header */}
          <View style={styles.modalTitleRow}>
            <Text style={styles.modalTitleText}>New Post</Text>
            <Pressable onPress={closeModal} hitSlop={8}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          {/* category chips */}
          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.modalChipScroll}
            contentContainerStyle={styles.modalChipRow}
          >
            {displayCategories.map((cat) => (
              <Pressable
                key={cat.key}
                style={[styles.chip, postCategory === cat.key && styles.chipActive]}
                onPress={() => setPostCategory(cat.key)}
              >
                <View style={styles.chipInner}>
                  <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.chipText, postCategory === cat.key && styles.chipTextActive]}>
                    {' '}{cat.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {/* content input */}
          <Text style={styles.fieldLabel}>Content</Text>
          <TextInput
            style={styles.contentInput}
            placeholder="Share advice, ask a question, or start a discussion..."
            placeholderTextColor="#999"
            multiline
            maxLength={1000}
            value={postContent}
            onChangeText={setPostContent}
            textAlignVertical="top"
          />
          <Text style={styles.charCounter}>{postContent.length}/1000</Text>

          {/* photo row */}
          <View style={styles.photoRow}>
            <Pressable style={styles.photoBtn} onPress={pickImage}>
              <Text style={styles.photoBtnText}>📷 Add Photo</Text>
            </Pressable>
            {pickedImageUri && (
              <View style={styles.thumbnailWrap}>
                <Image source={{ uri: pickedImageUri }} style={styles.thumbnail} />
                <Pressable
                  style={styles.thumbnailRemove}
                  onPress={() => setPickedImageUri(null)}
                >
                  <Text style={styles.thumbnailRemoveText}>✕</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* post button */}
          <Pressable
            style={[
              styles.postBtn,
              (!postContent.trim() || !postCategory || submitting) && styles.postBtnDisabled,
            ]}
            onPress={handleSubmitPost}
            disabled={!postContent.trim() || !postCategory || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.postBtnText}>Post</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );

  // ── main render ─────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }}>
      {view === 'feed' ? renderFeed() : renderDetail()}
      {showModal && renderModal()}
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  hamburger: { fontSize: 22, color: '#2C2C2C', width: 32 },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  logoIcon: { fontSize: 22, marginRight: 4 },
  logoText: { fontSize: 18, fontWeight: '700', color: GREEN },
  headerTitleBlock: { alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#2C2C2C' },
  headerSubtitle: { fontSize: 10, color: '#888', marginTop: 1 },
  composeBtn: { padding: 4 },
  composeBtnText: { fontSize: 22 },

  // category filter bar
  filterBar: { flexShrink: 0 },
  filterBarContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    marginRight: 8,
    backgroundColor: '#FFF',
  },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipInner: { flexDirection: 'row', alignItems: 'center' },
  chipEmoji: { fontSize: 13, lineHeight: 18 },
  chipText: { fontSize: 13, color: '#555', lineHeight: 18 },
  chipTextActive: { color: '#FFF', fontWeight: '600' },

  // post card
  postCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    marginHorizontal: 16,
  },
  postHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#37474F' },
  postMeta: { flex: 1 },
  postAuthor: { fontSize: 14, fontWeight: '600', color: '#2C2C2C', marginBottom: 3 },
  catPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start' },
  catPillText: { fontSize: 11, fontWeight: '600', color: '#333' },
  postRight: { alignItems: 'flex-end', gap: 4 },
  postTime: { fontSize: 11, color: '#999' },
  moreBtn: { padding: 2 },
  moreBtnText: { fontSize: 18, color: '#999', letterSpacing: 1 },
  postContent: { fontSize: 14, color: '#333', lineHeight: 22, marginBottom: 8 },
  readMore: { fontSize: 13, color: GREEN, marginBottom: 8, fontWeight: '500' },
  postMedia: { width: '100%', height: 200, borderRadius: 8, marginBottom: 10 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  actionIcon: { fontSize: 16, opacity: 0.5 },
  actionIconLiked: { opacity: 1 },
  actionCount: { fontSize: 13, color: '#666', marginLeft: 5 },
  actionCountLiked: { color: '#1976D2', fontWeight: '600' },

  // empty state
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22 },

  // tab bar
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingHorizontal: 4,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  tabItem: { alignItems: 'center', flex: 1 },
  tabIconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tabIconWrapActive: { backgroundColor: GREEN_LIGHT },
  tabIcon: { fontSize: 18 },
  tabLabel: { fontSize: 9, color: '#666' },
  tabLabelActive: { color: GREEN, fontWeight: '600' },

  // detail view
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 6, width: 64 },
  backBtnText: { fontSize: 15, color: GREEN, fontWeight: '500' },
  detailHeaderTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#2C2C2C', textAlign: 'center' },

  commentsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  commentsHeaderText: { fontSize: 15, fontWeight: '600', color: '#2C2C2C' },

  // comment row
  commentRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  commentTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  avatarSm: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarSmText: { fontSize: 12, fontWeight: '700', color: '#37474F' },
  commentAuthor: { flex: 1, fontSize: 13, fontWeight: '600', color: '#2C2C2C' },
  commentTime: { fontSize: 11, color: '#999' },
  commentContent: { fontSize: 14, color: '#333', lineHeight: 20, paddingLeft: 36 },

  emptyComments: { padding: 32, alignItems: 'center' },
  emptyCommentsText: { fontSize: 14, color: '#999', textAlign: 'center' },

  // comment input bar
  commentBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    backgroundColor: '#FFF',
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#F5F5F5',
    borderRadius: 22,
    marginRight: 8,
    maxHeight: 96,
    color: '#2C2C2C',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#B0BEC5' },
  sendBtnText: { fontSize: 18, color: '#FFF', fontWeight: '700' },

  // modal
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 101,
  },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitleText: { fontSize: 18, fontWeight: '700', color: '#2C2C2C' },
  modalCloseText: { fontSize: 20, color: '#666', paddingHorizontal: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },
  modalChipScroll: { marginBottom: 16 },
  modalChipRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 8, paddingVertical: 4 },

  contentInput: {
    height: 120,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 22,
    color: '#2C2C2C',
    marginBottom: 4,
  },
  charCounter: { fontSize: 12, color: '#AAA', textAlign: 'right', marginBottom: 12 },

  photoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    marginRight: 12,
  },
  photoBtnText: { fontSize: 14, color: '#555' },
  thumbnailWrap: { position: 'relative' },
  thumbnail: { width: 60, height: 60, borderRadius: 8 },
  thumbnailRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF5252',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailRemoveText: { fontSize: 10, color: '#FFF', fontWeight: '700' },

  postBtn: {
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  postBtnDisabled: { backgroundColor: '#B0BEC5' },
  postBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  // Feed/Leaderboard tab switcher
  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
  },
  tabSwitchBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabSwitchBtnActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabSwitchText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  tabSwitchTextActive: { color: '#111827' },

  // Leaderboard
  lbHeader: { padding: 16, paddingBottom: 8 },
  lbTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  lbSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  lbRowMe: { borderWidth: 1.5, borderColor: GREEN, borderRadius: 12, marginHorizontal: 8, marginVertical: 3 },
  lbRank: { fontSize: 22, width: 36, textAlign: 'center', fontWeight: '700' },
  lbAvatar: { width: 40, height: 40, borderRadius: 20 },
  lbName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  lbStreak: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  lbCoins: { fontSize: 15, fontWeight: '700', color: '#F59E0B' },
});
