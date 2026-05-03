import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../../core/theme/useTheme';
import { useProfileStore } from './store';
import { useGamificationStore } from '../gamification/store';
import { ANIMAL_TYPE_OPTIONS, REGIONS } from './types';

const GREEN = '#4CAF50';

export function ProfileScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { profile, loading, saving, fetchProfile, updateProfile, uploadAvatar, error } =
    useProfileStore();
  const { dashboard, fetchDashboard } = useGamificationStore();

  const [editing, setEditing] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(dashboard?.seconds_until_reset ?? 0);

  // Edit-mode form state
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [yearsExp, setYearsExp] = useState('');
  const [animalTypes, setAnimalTypes] = useState<string[]>([]);
  const [bio, setBio] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchDashboard();
  }, []);

  // Reset countdown when dashboard refreshes
  useEffect(() => {
    setTimeLeft(dashboard?.seconds_until_reset ?? 0);
  }, [dashboard?.seconds_until_reset]);

  // Tick down every second
  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, []);

  const enterEdit = () => {
    setDisplayName(profile?.display_name ?? '');
    setPhone(profile?.phone ?? '');
    setRegion(profile?.region ?? null);
    setYearsExp(profile?.years_experience?.toString() ?? '');
    setAnimalTypes(profile?.animal_types ?? []);
    setBio(profile?.bio ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateProfile({
        display_name: displayName || undefined,
        phone: phone || undefined,
        region: (region as any) || undefined,
        years_experience: yearsExp ? parseInt(yearsExp, 10) : undefined,
        animal_types: animalTypes.length > 0 ? animalTypes : undefined,
        bio: bio || undefined,
      });
      setEditing(false);
    } catch {
      Alert.alert('Save failed', error ?? 'Could not save profile. Please try again.');
    }
  };

  const pickAvatar = () => {
    Alert.alert('Profile Photo', 'Choose source', [
      {
        text: 'Camera',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            handleAvatarUpload(result.assets[0].uri);
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            handleAvatarUpload(result.assets[0].uri);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAvatarUpload = async (uri: string) => {
    setAvatarUploading(true);
    try {
      await uploadAvatar(uri);
    } catch {
      Alert.alert('Upload failed', 'Could not upload photo. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const initials = (profile?.display_name ?? 'F').slice(0, 2).toUpperCase();

  const completedFields = [
    profile?.display_name,
    profile?.phone,
    profile?.region,
    profile?.years_experience !== null && profile?.years_experience !== undefined,
    profile?.animal_types && profile.animal_types.length > 0,
    profile?.avatar_url,
  ].filter(Boolean).length;

  const AvatarView = ({ size = 100, editable = false }: { size?: number; editable?: boolean }) => {
    const radius = size / 2;
    const content = avatarUploading ? (
      <View style={[{ width: size, height: size, borderRadius: radius, backgroundColor: colors.inputBg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={GREEN} />
      </View>
    ) : profile?.avatar_url ? (
      <Image source={{ uri: profile.avatar_url }} style={{ width: size, height: size, borderRadius: radius }} />
    ) : (
      <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: GREEN, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: size * 0.34, fontWeight: '700', color: '#FFF' }}>{initials}</Text>
      </View>
    );

    if (!editable) return content;
    return (
      <Pressable onPress={pickAvatar} style={{ position: 'relative' }}>
        {content}
        <View style={styles.cameraBadge}>
          <Text style={{ fontSize: 14 }}>📷</Text>
        </View>
      </Pressable>
    );
  };

  if (loading && !profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.headerBorder }]}>
          <Pressable onPress={() => setEditing(false)} hitSlop={8}>
            <Text style={[styles.headerAction, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={8}>
            {saving
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={[styles.headerAction, { color: colors.primary, fontWeight: '700' }]}>Save</Text>
            }
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
          {/* Avatar */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <AvatarView size={96} editable />
            <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>Tap to change photo</Text>
          </View>

          {/* Full name */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>FULL NAME</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={colors.textSecondary}
          />

          {/* Phone */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>PHONE</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 55 123 456"
            keyboardType="phone-pad"
            placeholderTextColor={colors.textSecondary}
          />

          {/* Region */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>REGION</Text>
          <View style={styles.pillRow}>
            {REGIONS.map(r => (
              <Pressable
                key={r.key}
                onPress={() => setRegion(region === r.key ? null : r.key)}
                style={[
                  styles.pill,
                  region === r.key
                    ? { backgroundColor: GREEN, borderColor: GREEN }
                    : { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                ]}
              >
                <Text style={[styles.pillText, { color: region === r.key ? '#FFF' : colors.text }]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Years experience */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>YEARS OF EXPERIENCE</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]}
            value={yearsExp}
            onChangeText={setYearsExp}
            placeholder="e.g. 10"
            keyboardType="numeric"
            placeholderTextColor={colors.textSecondary}
          />

          {/* Animals */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>ANIMALS I RAISE</Text>
          <View style={styles.chipGrid}>
            {ANIMAL_TYPE_OPTIONS.map(a => {
              const active = animalTypes.includes(a.key);
              return (
                <Pressable
                  key={a.key}
                  onPress={() =>
                    setAnimalTypes(prev =>
                      active ? prev.filter(k => k !== a.key) : [...prev, a.key],
                    )
                  }
                  style={[
                    styles.animalChip,
                    active
                      ? { backgroundColor: GREEN, borderColor: GREEN }
                      : { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  ]}
                >
                  <Text style={{ fontSize: 16 }}>{a.emoji}</Text>
                  <Text style={[styles.chipLabel, { color: active ? '#FFF' : colors.text }]}>
                    {a.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Bio */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>BIO</Text>
          <TextInput
            style={[styles.input, styles.bioInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about your farm…"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            maxLength={200}
          />
          <Text style={[styles.charCount, { color: colors.textSecondary }]}>{bio.length}/200</Text>

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.saveBtnText}>Save Changes</Text>
            }
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── VIEW MODE ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.headerBorder }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}>
          <Text style={[styles.headerAction, { color: colors.primary }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <Pressable onPress={enterEdit} hitSlop={8}>
          <Text style={[styles.headerAction, { color: colors.primary }]}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Avatar + badge */}
        <View style={styles.avatarSection}>
          <AvatarView size={100} />
          {profile?.is_verified_farmer && (
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>🏅 Verified Farmer</Text>
            </View>
          )}
          {profile?.is_verified_farmer && (
            <Text style={[styles.badgeSub, { color: colors.textSecondary }]}>
              Profile complete + Tutorial done
            </Text>
          )}
          <Text style={[styles.profileName, { color: colors.text }]}>
            {profile?.display_name ?? 'Farmer'}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
            {profile?.email ?? ''}
          </Text>
        </View>

        {/* Completion card */}
        {!profile?.is_verified_farmer && (
          <View style={styles.completionCard}>
            <Text style={styles.completionTitle}>
              Complete your profile to earn the Verified Farmer badge 🏅
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(completedFields / 6) * 100}%` as any }]} />
            </View>
            <Text style={styles.completionCount}>{completedFields}/6 fields complete</Text>
            <Pressable style={styles.completionBtn} onPress={enterEdit}>
              <Text style={styles.completionBtnText}>Complete Profile →</Text>
            </Pressable>
          </View>
        )}

        {/* ── Coin balance card ─────────────────────────────────── */}
        <View style={[styles.coinCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={{ fontSize: 32 }}>🪙</Text>
          <View style={{ marginLeft: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#F59E0B' }}>
              {dashboard?.balance ?? 0}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>coins</Text>
          </View>
          <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              🔥 {dashboard?.login_streak ?? 0} day streak
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {dashboard?.total_earned ?? 0} total earned
            </Text>
          </View>
        </View>

        {/* ── Daily tasks ───────────────────────────────────────── */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Title row + countdown */}
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>📋 Daily Tasks</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
              {`Resets in ${Math.floor(timeLeft / 3600)}h ${Math.floor((timeLeft % 3600) / 60)}m ${timeLeft % 60}s`}
            </Text>
          </View>

          {!profile?.is_verified_farmer ? (
            <View style={styles.lockMsg}>
              <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 }}>
                🔒 Earn the Verified Farmer badge to unlock daily tasks and coins
              </Text>
            </View>
          ) : dashboard?.tasks && dashboard.tasks.length > 0 ? (
            dashboard.tasks.map(task => (
              <View
                key={task.key}
                style={[
                  styles.taskRow,
                  { borderBottomColor: colors.cardBorder },
                  task.completed && styles.taskRowCompleted,
                ]}
              >
                <Text style={{ fontSize: 24, marginRight: 12 }}>{task.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskLabel, { color: task.completed ? '#6B7280' : colors.text }]}>
                    {task.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {task.description}
                  </Text>
                </View>
                <View style={[styles.taskBadge, task.completed ? styles.taskBadgeDone : styles.taskBadgePending]}>
                  <Text style={{ fontSize: 12, color: task.completed ? '#16A34A' : '#9CA3AF', fontWeight: '600' }}>
                    {task.completed ? `✓ +${task.coins_reward}🪙` : `+${task.coins_reward}🪙`}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.lockMsg}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>Loading tasks…</Text>
            </View>
          )}
        </View>

        {/* ── Rewards ───────────────────────────────────────────── */}
        <View style={[styles.sectionCard, styles.rewardsCard, { borderColor: colors.cardBorder }]}>
          <Text style={styles.sectionTitle}>🎁 Rewards</Text>
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 8, lineHeight: 20 }}>
            Coming soon — partner discount codes and prizes
          </Text>
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
            Keep earning coins now to spend when rewards launch!
          </Text>
        </View>

        {/* Info rows */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {[
            { icon: '📱', label: 'Phone', value: profile?.phone ?? 'Not set' },
            {
              icon: '📍',
              label: 'Region',
              value: REGIONS.find(r => r.key === profile?.region)?.label ?? 'Not set',
            },
            {
              icon: '🌾',
              label: 'Experience',
              value:
                profile?.years_experience !== null && profile?.years_experience !== undefined
                  ? `${profile.years_experience} years`
                  : 'Not set',
            },
            {
              icon: '🐄',
              label: 'Animals',
              value:
                profile?.animal_types?.length
                  ? profile.animal_types
                      .map(k => {
                        const a = ANIMAL_TYPE_OPTIONS.find(o => o.key === k);
                        return a ? `${a.emoji} ${a.label}` : k;
                      })
                      .join(', ')
                  : 'Not set',
            },
            { icon: '📝', label: 'Bio', value: profile?.bio ?? 'Not set' },
          ].map((row, i, arr) => (
            <View
              key={row.label}
              style={[
                styles.infoRow,
                { borderBottomColor: colors.cardBorder },
                i === arr.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={styles.infoIcon}>{row.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{row.label}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable style={[styles.editBtn, { borderColor: GREEN }]} onPress={enterEdit}>
          <Text style={[styles.editBtnText, { color: GREEN }]}>✏️ Edit Profile</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerAction: { fontSize: 15, fontWeight: '600', minWidth: 60 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  // Avatar
  avatarSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { fontSize: 12, marginTop: 8 },
  // Badge
  badgePill: {
    marginTop: 10,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  badgeSub: { fontSize: 12, marginTop: 4 },
  profileName: { fontSize: 20, fontWeight: '700', marginTop: 10 },
  profileEmail: { fontSize: 14, marginTop: 4 },
  // Completion card
  completionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  completionTitle: { fontSize: 14, fontWeight: '600', color: '#1E40AF', marginBottom: 12 },
  progressTrack: {
    height: 8,
    backgroundColor: '#DBEAFE',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: { height: '100%', backgroundColor: '#22C55E', borderRadius: 4 },
  completionCount: { fontSize: 12, color: '#3B82F6', marginBottom: 12 },
  completionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  completionBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  // Info card
  infoCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoIcon: { fontSize: 18, marginRight: 12, marginTop: 2 },
  infoLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 15 },
  editBtn: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editBtnText: { fontSize: 15, fontWeight: '600' },
  // Form
  formContent: { padding: 16, paddingBottom: 48 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 6, marginTop: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  bioInput: { minHeight: 90, textAlignVertical: 'top' },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 4 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 14, fontWeight: '500' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  animalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 13, fontWeight: '500' },
  saveBtn: {
    marginTop: 24,
    backgroundColor: GREEN,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  // Gamification
  coinCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  rewardsCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  lockMsg: { padding: 20, alignItems: 'center' },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFF',
  },
  taskRowCompleted: { backgroundColor: '#F0FDF4' },
  taskLabel: { fontSize: 14, fontWeight: '600' },
  taskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginLeft: 8,
  },
  taskBadgeDone: { backgroundColor: '#DCFCE7' },
  taskBadgePending: { backgroundColor: '#F3F4F6' },
});
