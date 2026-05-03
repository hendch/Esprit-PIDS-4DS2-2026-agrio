import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Routes } from '../../core/navigation/routes';
import { useDrawerStore } from '../../core/drawer/drawerStore';
import { useTheme } from '../../core/theme/useTheme';
import { useLivestockStore } from './store';
import {
  EVENT_COLORS,
  GREEN,
  STATUS_COLORS,
  styles,
} from './LivestockScreen.styles';

import {
  ANIMAL_TYPES,
  HEALTH_EVENT_TYPES,
  type Animal,
  type HealthEvent,
} from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatAge(months: number | null): string {
  if (months === null) return '—';
  if (months < 12) return `${months}m`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y}y ${m}m` : `${y}y`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-TN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function animalEmoji(type: string): string {
  return ANIMAL_TYPES.find(t => t.value === type)?.emoji ?? '🐄';
}

function animalLabel(type: string): string {
  return ANIMAL_TYPES.find(t => t.value === type)?.label ?? type;
}

function formatMonthYear(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ─── TabBar ─────────────────────────────────────────────────────────────────

function TabBar({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const tabs = [
    { key: 'Home',      icon: '🏠', route: Routes.Dashboard },
    { key: 'Land',      icon: '🗺️', route: Routes.Satellite },
    { key: 'Crop',      icon: '🌱', route: Routes.DiseaseDetection },
    { key: 'Water',     icon: '💧', route: Routes.Irrigation },
    { key: 'Livestock', icon: '🐄', route: Routes.Livestock },
    { key: 'Prices',    icon: '📈', route: Routes.MarketPrices },
    { key: 'Community', icon: '👥', route: Routes.Community },
  ];
  return (
    <View style={[styles.tabBar, {
      paddingBottom: insets.bottom + 8,
      backgroundColor: colors.background,
      borderTopColor: colors.headerBorder,
    }]}>
      {tabs.map(t => (
        <Pressable key={t.key} onPress={() => nav.navigate(t.route)} style={styles.tabItem}>
          <View style={[styles.tabIconWrap, active === t.key && styles.tabIconWrapActive]}>
            <Text style={styles.tabIcon}>{t.icon}</Text>
          </View>
          <Text style={[styles.tabLabel, { color: colors.textSecondary },
            active === t.key && styles.tabLabelActive]}>
            {t.key}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Add / Edit Animal Modal ─────────────────────────────────────────────────

function AnimalModal({
  visible,
  onClose,
  onSaved,
  initial,
  farmId,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initial: Animal | null;
  farmId: string;
}) {
  const store = useLivestockStore();
  const { colors } = useTheme();

  const [name, setName]           = useState('');
  const [animalType, setAnimalType] = useState('vache');
  const [breed, setBreed]         = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [tagId, setTagId]         = useState('');
  const [status, setStatus]       = useState('active');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate]   = useState('');
  const [localError, setLocalError] = useState('');

  // Pre-fill when editing
  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setAnimalType(initial.animal_type);
      setBreed(initial.breed ?? '');
      setBirthDate(initial.birth_date ?? '');
      setTagId(initial.tag_id ?? '');
      setStatus(initial.status);
      setPurchasePrice(initial.purchase_price != null ? String(initial.purchase_price) : '');
      setPurchaseDate(initial.purchase_date ?? '');
    } else {
      setName(''); setAnimalType('vache'); setBreed('');
      setBirthDate(''); setTagId(''); setStatus('active'); setPurchasePrice(''); setPurchaseDate('');
    }
    setLocalError('');
  }, [visible, initial]);

  const handleSave = async () => {
    if (!name.trim()) { setLocalError('Name is required'); return; }
    setLocalError('');
    try {
      const payload: any = {
        farm_id: farmId,
        name: name.trim(),
        animal_type: animalType,
        status,
      };
      if (breed.trim()) payload.breed = breed.trim();
      if (birthDate.trim()) payload.birth_date = birthDate.trim();
      if (tagId.trim()) payload.tag_id = tagId.trim();
      const parsedPrice = parseFloat(purchasePrice);
      if (purchasePrice.trim() && !isNaN(parsedPrice)) payload.purchase_price = parsedPrice;
      if (purchaseDate.trim()) payload.purchase_date = purchaseDate.trim();

      if (initial) {
        const { farm_id: _f, ...update } = payload;
        await store.editAnimal(initial.id, update);
      } else {
        await store.addAnimal(payload);
      }
      onClose();
      onSaved?.();
    } catch (e: any) {
      setLocalError(e?.message ?? 'Error saving animal');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {initial ? 'Edit Animal' : 'New Animal'}
            </Text>
            <Text style={styles.closeBtn} onPress={onClose}>✕</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.formLabel, { color: colors.text }]}>Name *</Text>
            <TextInput
              style={[styles.textInput, { borderColor: '#DDD', color: colors.text, backgroundColor: colors.card }]}
              value={name} onChangeText={setName} placeholder="e.g. Bessie"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.formLabel, { color: colors.text }]}>Animal type *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}>
              {ANIMAL_TYPES.map(t => (
                <Pressable key={t.value}
                  style={[styles.pill, animalType === t.value && styles.pillActive]}
                  onPress={() => setAnimalType(t.value)}>
                  <Text style={[styles.pillText, animalType === t.value && styles.pillTextActive]}>
                    {t.emoji} {t.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.formLabel, { color: colors.text }]}>Breed</Text>
            <TextInput
              style={[styles.textInput, { borderColor: '#DDD', color: colors.text, backgroundColor: colors.card }]}
              value={breed} onChangeText={setBreed} placeholder="optional"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.formLabel, { color: colors.text }]}>Birth date</Text>
            <TextInput
              style={[styles.textInput, { borderColor: '#DDD', color: colors.text, backgroundColor: colors.card }]}
              value={birthDate} onChangeText={setBirthDate} placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={[styles.formHint, { color: colors.textSecondary }]}>
              Used to calculate age
            </Text>

            <Text style={[styles.formLabel, { color: colors.text }]}>Tag / Ear ID</Text>
            <TextInput
              style={[styles.textInput, { borderColor: '#DDD', color: colors.text, backgroundColor: colors.card }]}
              value={tagId} onChangeText={setTagId} placeholder="optional"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.formLabel, { color: colors.text }]}>Purchase Price (TND)</Text>
            <TextInput
              style={[styles.textInput, { borderColor: '#DDD', color: colors.text, backgroundColor: colors.card }]}
              value={purchasePrice} onChangeText={setPurchasePrice}
              placeholder="e.g. 1500" keyboardType="numeric"
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={[styles.formHint, { color: colors.textSecondary }]}>
              Used to calculate profit/loss
            </Text>

            <Text style={[styles.formLabel, { color: colors.text }]}>Purchase Date</Text>
            <TextInput
              style={[styles.textInput, { borderColor: '#DDD', color: colors.text, backgroundColor: colors.card }]}
              value={purchaseDate} onChangeText={setPurchaseDate}
              placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary}
            />
            <Text style={[styles.formHint, { color: colors.textSecondary }]}>
              If you don't remember the price, enter the purchase date and we'll estimate it from market data
            </Text>

            <Text style={[styles.formLabel, { color: colors.text }]}>Status</Text>
            <View style={styles.pillRow}>
              {['active', 'sold', 'deceased'].map(s => (
                <Pressable key={s}
                  style={[styles.pill, status === s && styles.pillActive]}
                  onPress={() => setStatus(s)}>
                  <Text style={[styles.pillText, status === s && styles.pillTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {localError ? <Text style={styles.modalError}>{localError}</Text> : null}

            <Pressable
              style={[styles.saveBtn, { backgroundColor: GREEN, opacity: store.submitting ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={store.submitting}>
              {store.submitting
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.saveBtnText}>{initial ? 'Update' : 'Save'}</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Health Event Modal ──────────────────────────────────────────────────

function HealthEventModal({
  visible,
  onClose,
  animalId,
  farmId,
}: {
  visible: boolean;
  onClose: () => void;
  animalId: string;
  farmId: string;
}) {
  const store = useLivestockStore();
  const { colors } = useTheme();
  const [eventType, setEventType] = useState('vaccination');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(todayIso());
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (visible) {
      setEventType('vaccination'); setDescription('');
      setEventDate(todayIso()); setLocalError('');
    }
  }, [visible]);

  const handleSave = async () => {
    if (!eventDate.trim()) { setLocalError('Date is required'); return; }
    setLocalError('');
    try {
      await store.addHealthEvent(animalId, farmId, {
        event_type: eventType,
        description: description.trim() || undefined,
        event_date: eventDate.trim(),
      });
      onClose();
    } catch (e: any) {
      setLocalError(e?.message ?? 'Error saving event');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Health Event</Text>
            <Text style={styles.closeBtn} onPress={onClose}>✕</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.formLabel, { color: colors.text }]}>Event type</Text>
            <View style={styles.pillRow}>
              {HEALTH_EVENT_TYPES.map(t => (
                <Pressable key={t.value}
                  style={[styles.pill, eventType === t.value && styles.pillActive]}
                  onPress={() => setEventType(t.value)}>
                  <Text style={[styles.pillText, eventType === t.value && styles.pillTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.formLabel, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[styles.textInputMulti, { borderColor: '#DDD', color: colors.text, backgroundColor: colors.card }]}
              value={description} onChangeText={setDescription}
              placeholder="optional notes" multiline numberOfLines={3}
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.formLabel, { color: colors.text }]}>Date</Text>
            <TextInput
              style={[styles.textInput, { borderColor: '#DDD', color: colors.text, backgroundColor: colors.card }]}
              value={eventDate} onChangeText={setEventDate} placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
            />

            {localError ? <Text style={styles.modalError}>{localError}</Text> : null}

            <Pressable
              style={[styles.saveBtn, { backgroundColor: GREEN, opacity: store.submitting ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={store.submitting}>
              {store.submitting
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.saveBtnText}>Save</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function LivestockScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const store = useLivestockStore();

  const [view, setView]           = useState<'list' | 'detail'>('list');
  const [filter, setFilter]       = useState<'all' | 'active' | 'other'>('all');
  const [showAddModal, setShowAddModal]     = useState(false);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);

  // Resolve farmId + load animals on mount
  useEffect(() => {
    store.resolveFarmId().then(() => store.fetchAnimals());
  }, []);

  // Reload animals when farmId becomes available
  useEffect(() => {
    if (store.farmId) store.fetchAnimals();
  }, [store.farmId]);

  // Load herd stats whenever farmId is ready
  useEffect(() => {
    if (store.farmId) store.fetchHerdStats(store.farmId);
  }, [store.farmId]);

  const farmId = store.farmId ?? '';

  // Filtered animal list
  const filteredAnimals = store.animals.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'active') return a.status === 'active';
    return a.status === 'sold' || a.status === 'deceased';
  });

  const handleSelectAnimal = useCallback((animal: Animal) => {
    store.selectAnimal(animal);
    store.fetchHealthEvents(animal.id);
    setView('detail');
  }, [store]);

  useEffect(() => {
    if (store.selectedAnimal && farmId) {
      store.fetchMarketPrice(store.selectedAnimal.id);
      store.fetchPnL(store.selectedAnimal.id, farmId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.selectedAnimal]);

  const handleLongPress = useCallback((animal: Animal) => {
    Alert.alert(
      'Delete Animal',
      `Remove "${animal.name}" from your records? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => store.removeAnimal(animal.id).then(() => {
            if (farmId) store.fetchHerdStats(farmId);
          }),
        },
      ]
    );
  }, [store, farmId]);

  const handleDeleteEvent = useCallback((event: HealthEvent) => {
    if (!store.selectedAnimal) return;
    Alert.alert('Delete Event', 'Remove this health event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () =>
          store.removeHealthEvent(store.selectedAnimal!.id, event.id, farmId),
      },
    ]);
  }, [store, farmId]);

  const handleBack = () => {
    setView('list');
    store.selectAnimal(null);
    store.fetchAnimals();
  };

  // ── LIST VIEW ──────────────────────────────────────────────────────────

  const renderAnimalCard = ({ item }: { item: Animal }) => {
    const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.active;
    return (
      <Pressable
        style={({ pressed }) => [styles.animalCard, pressed && styles.pressed]}
        onPress={() => handleSelectAnimal(item)}
        onLongPress={() => handleLongPress(item)}>
        <View style={styles.animalEmojiCircle}>
          <Text style={styles.animalEmoji}>{animalEmoji(item.animal_type)}</Text>
        </View>
        <View style={styles.animalBody}>
          <View style={styles.animalNameRow}>
            <Text style={[styles.animalName, { color: colors.text }]}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusBadgeText, { color: sc.text }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={[styles.animalSubtitle, { color: colors.textSecondary }]}>
            {animalLabel(item.animal_type)}{item.breed ? ` · ${item.breed}` : ''}
          </Text>
          <Text style={[styles.animalMeta, { color: colors.textSecondary }]}>
            {formatAge(item.age_months)}
            {item.tag_id ? `  🏷 ${item.tag_id}` : ''}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
      </Pressable>
    );
  };

  const listView = (
    <>
      {/* List header */}
      <View style={styles.listHeaderRow}>
        <Text style={[styles.listTitle, { color: colors.text }]}>🐄 My Animals</Text>
        <Pressable
          style={[styles.addBtn, { backgroundColor: GREEN }]}
          onPress={() => setShowAddModal(true)}>
          <Text style={styles.addBtnText}>＋ Add</Text>
        </Pressable>
      </View>

      {/* Herd stats card */}
      {store.statsLoading && (
        <View style={[styles.statsCard, { alignItems: 'center', height: 80, justifyContent: 'center' }]}>
          <ActivityIndicator color="#1E88E5" />
        </View>
      )}
      {!store.statsLoading && store.herdStats && store.herdStats.total_animals > 0 && (
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statsBox}>
              <Text style={styles.statsNumber}>{store.herdStats.total_animals}</Text>
              <Text style={styles.statsLabel}>Animals</Text>
            </View>
            <View style={styles.statsBox}>
              <Text style={[styles.statsNumber, { fontSize: 17 }]}>
                {Math.round(store.herdStats.total_herd_value).toLocaleString('fr-TN')} TND
              </Text>
              <Text style={styles.statsLabel}>Herd Value</Text>
            </View>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsRow}>
            <View style={styles.statsBox}>
              <Text style={styles.statsNumber}>
                {store.herdStats.avg_age_months != null ? formatAge(store.herdStats.avg_age_months) : '—'}
              </Text>
              <Text style={styles.statsLabel}>Avg Age</Text>
            </View>
            <View style={styles.statsBox}>
              <Text style={[styles.statsNumber, {
                color: store.herdStats.due_vaccination > 0 ? '#E65100' : '#2E7D32',
              }]}>
                {store.herdStats.due_vaccination}
              </Text>
              <Text style={styles.statsLabel}>Due Vaccination</Text>
            </View>
          </View>
          {store.herdStats.due_vaccination > 0 && (
            <Text style={styles.statsWarning}>
              ⚠ {store.herdStats.due_vaccination} animal{store.herdStats.due_vaccination > 1 ? 's' : ''} due for vaccination
            </Text>
          )}
        </View>
      )}

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'other'] as const).map(f => (
          <Pressable key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}>
            <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Sold / Deceased'}
            </Text>
          </Pressable>
        ))}
      </View>

      {store.loading && store.animals.length === 0 ? (
        <ActivityIndicator size="large" color={GREEN} style={{ marginTop: 40 }} />
      ) : filteredAnimals.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🐑</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No animals yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Tap ＋ Add to register your first animal
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAnimals}
          keyExtractor={item => item.id}
          renderItem={renderAnimalCard}
          scrollEnabled={false}
        />
      )}
    </>
  );

  // ── DETAIL VIEW ────────────────────────────────────────────────────────

  const animal = store.selectedAnimal;

  const detailView = animal ? (
    <>
      {/* Back */}
      <Pressable style={styles.backRow} onPress={handleBack}>
        <Text style={[styles.backText, { color: GREEN }]}>← Back</Text>
      </Pressable>

      {/* Info card */}
      <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
        <View style={styles.infoTitleRow}>
          <Text style={styles.infoEmoji}>{animalEmoji(animal.animal_type)}</Text>
          <Text style={[styles.infoAnimalName, { color: colors.text }]}>{animal.name}</Text>
          <Pressable
            style={[styles.editBtn, { borderColor: GREEN }]}
            onPress={() => setShowEditModal(true)}>
            <Text style={[styles.editBtnText, { color: GREEN }]}>Edit</Text>
          </Pressable>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoGrid}>
          {[
            { label: 'Type',   value: animalLabel(animal.animal_type) },
            { label: 'Breed',  value: animal.breed ?? '—' },
            { label: 'Age',    value: formatAge(animal.age_months) },
            { label: 'Status', value: animal.status },
            { label: 'Tag ID', value: animal.tag_id ?? '—' },
            { label: 'Market', value: animal.market_series ?? '—' },
          ].map(chip => (
            <View key={chip.label} style={[styles.infoChip, { backgroundColor: colors.background }]}>
              <Text style={[styles.infoChipLabel, { color: colors.textSecondary }]}>{chip.label}</Text>
              <Text style={[styles.infoChipValue, { color: colors.text }]}>{chip.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Market price card */}
      <View style={[styles.marketCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>📈 Current Market Value</Text>
        {store.loading && !store.marketPrice ? (
          <ActivityIndicator color={GREEN} style={{ marginVertical: 12 }} />
        ) : store.marketPrice ? (
          <>
            <Text style={[styles.marketPrice, { color: colors.text }]}>
              {store.marketPrice.latest_price.toLocaleString('fr-TN')} {store.marketPrice.unit}
            </Text>
            <Text style={[styles.marketSeries, { color: colors.textSecondary }]}>
              {store.marketPrice.series_name}
            </Text>
            <Text style={styles.marketGrowth}>
              Annual growth: {store.marketPrice.cagr_pct >= 0 ? '+' : ''}{store.marketPrice.cagr_pct.toFixed(1)}%
            </Text>
            <Pressable
              style={[styles.marketBtn, { backgroundColor: GREEN }]}
              onPress={() => nav.navigate(Routes.MarketPrices)}>
              <Text style={styles.marketBtnText}>View 12-month forecast →</Text>
            </Pressable>
          </>
        ) : (
          <Text style={[styles.noMarketText, { color: colors.textSecondary }]}>
            No market price data available for this animal type
          </Text>
        )}
      </View>

      {/* P&L card */}
      <View style={[styles.pnlCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>💰 Profit & Loss Estimate</Text>
        {animal.purchase_price == null && animal.purchase_date == null ? (
          <>
            <Text style={[styles.pnlNoPriceText, { color: colors.textSecondary }]}>
              Add a purchase price or purchase date to calculate P&L
            </Text>
            <Pressable style={styles.addPriceBtn} onPress={() => setShowEditModal(true)}>
              <Text style={styles.addPriceBtnText}>Add Purchase Price</Text>
            </Pressable>
          </>
        ) : store.pnlLoading ? (
          <ActivityIndicator color={GREEN} style={{ marginVertical: 12 }} />
        ) : store.pnl ? (
          <>
            <View style={styles.pnlMetricRow}>
              <View style={styles.pnlMetricBox}>
                <Text style={styles.pnlMetricLabel}>Estimated Value</Text>
                <Text style={[styles.pnlMetricValue, { color: colors.text }]}>
                  {store.pnl.estimated_value != null
                    ? `${Math.round(store.pnl.estimated_value).toLocaleString('fr-TN')} TND`
                    : '—'}
                </Text>
              </View>
              <View style={styles.pnlMetricBox}>
                <Text style={styles.pnlMetricLabel}>
                  {store.pnl.purchase_price_source === 'estimated_from_date'
                    ? 'Est. Purchase Price'
                    : 'Purchase Price'}
                </Text>
                <Text style={[styles.pnlMetricValue, { color: colors.text }]}>
                  {store.pnl.purchase_price != null
                    ? `${Math.round(store.pnl.purchase_price).toLocaleString('fr-TN')} TND`
                    : '—'}
                </Text>
                {store.pnl.purchase_price_source === 'estimated_from_date' && store.pnl.purchase_date ? (
                  <Text style={styles.pnlMetricSub}>
                    ⓘ {formatMonthYear(store.pnl.purchase_date)} data
                  </Text>
                ) : null}
              </View>
              <View style={styles.pnlMetricBox}>
                <Text style={styles.pnlMetricLabel}>Feed Cost</Text>
                <Text style={[styles.pnlMetricValue, { color: colors.text }]}>
                  {store.pnl.total_feed_cost != null
                    ? `${Math.round(store.pnl.total_feed_cost).toLocaleString('fr-TN')} TND`
                    : '—'}
                </Text>
                <Text style={styles.pnlMetricSub}>
                  {store.pnl.monthly_bales} bales/mo × {store.pnl.ownership_months ?? '?'} mo owned
                </Text>
              </View>
              {store.pnl.is_dairy ? (
                <View style={styles.pnlMetricBox}>
                  <Text style={styles.pnlMetricLabel}>Milk Revenue</Text>
                  <Text style={[styles.pnlMetricValue, { color: '#2E7D32' }]}>
                    {Math.round(store.pnl.total_milk_revenue ?? 0).toLocaleString('fr-TN')} TND
                  </Text>
                  <Text style={styles.pnlMetricSub}>
                    {store.pnl.litres_per_month}L/mo × {store.pnl.ownership_months} mo
                  </Text>
                </View>
              ) : null}
              {store.pnl.has_offspring_revenue && store.pnl.total_offspring_revenue != null ? (
                <View style={styles.pnlMetricBox}>
                  <Text style={styles.pnlMetricLabel}>
                    {store.pnl.animal_type === 'ovin' ? 'Lamb Revenue' : 'Kid Revenue'}
                  </Text>
                  <Text style={[styles.pnlMetricValue, { color: '#2E7D32' }]}>
                    {Math.round(store.pnl.total_offspring_revenue).toLocaleString('fr-TN')} TND
                  </Text>
                  <Text style={styles.pnlMetricSub}>
                    {store.pnl.offspring_per_year}/yr × {((store.pnl.ownership_months ?? 0) / 12).toFixed(1)} yrs
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.pnlDivider} />

            <View style={styles.pnlSummaryRow}>
              <View style={[styles.pnlSummaryBox, {
                backgroundColor: (store.pnl.gross_pnl ?? 0) >= 0 ? '#E8F5E9' : '#FFEBEE',
              }]}>
                <Text style={[styles.pnlSummaryValue, {
                  color: (store.pnl.gross_pnl ?? 0) >= 0 ? '#2E7D32' : '#C62828',
                }]}>
                  {store.pnl.gross_pnl != null
                    ? `${store.pnl.gross_pnl > 0 ? '+' : ''}${Math.round(store.pnl.gross_pnl).toLocaleString('fr-TN')} TND`
                    : '—'}
                </Text>
                <Text style={[styles.pnlSummarySubLabel, { color: colors.textSecondary }]}>Gross P&L</Text>
                <Text style={styles.pnlSummarySubLabel}>Before feed costs</Text>
              </View>
              <View style={[styles.pnlSummaryBox, {
                backgroundColor: (store.pnl.net_pnl ?? 0) >= 0 ? '#E8F5E9' : '#FFEBEE',
              }]}>
                <Text style={[styles.pnlSummaryValue, {
                  color: (store.pnl.net_pnl ?? 0) >= 0 ? '#2E7D32' : '#C62828',
                }]}>
                  {store.pnl.net_pnl != null
                    ? `${store.pnl.net_pnl > 0 ? '+' : ''}${Math.round(store.pnl.net_pnl).toLocaleString('fr-TN')} TND`
                    : '—'}
                </Text>
                <Text style={[styles.pnlSummarySubLabel, { color: colors.textSecondary }]}>Net P&L</Text>
                <Text style={styles.pnlSummarySubLabel}>
                  {store.pnl.is_dairy
                    ? 'After feed costs + milk revenue'
                    : store.pnl.has_offspring_revenue
                      ? `After feed costs + ${store.pnl.animal_type === 'ovin' ? 'lamb' : 'kid'} revenue`
                      : 'After feed costs'}
                </Text>
              </View>
            </View>

            {!store.pnl.purchase_date ? (
              <Text style={[styles.pnlFootnote, { color: '#E65100' }]}>
                ⚠ Add a purchase date to include feed costs in the net calculation
              </Text>
            ) : null}
            {store.pnl.has_offspring_revenue ? (
              <Text style={styles.pnlFootnote}>
                {store.pnl.animal_type === 'ovin' ? 'Lambs' : 'Kids'}{': '}
                {store.pnl.offspring_per_year}/year at {store.pnl.offspring_weight_kg}kg × {store.pnl.offspring_price_per_kg} TND/kg
              </Text>
            ) : null}
            {!store.pnl.is_dairy && !store.pnl.has_offspring_revenue ? (
              <Text style={styles.pnlDisclaimer}>
                Note: P&L reflects resale value only. Milk and other revenue not included.
              </Text>
            ) : null}
            <Text style={styles.pnlFootnote}>
              {store.pnl.is_dairy
                ? `Milk: ${store.pnl.litres_per_month}L/month at ${store.pnl.milk_price_per_litre} TND/L (guaranteed min + transport)\n`
                : ''}
              {'Feed cost estimate: '}{store.pnl.monthly_bales}{' bales straw/month at '}
              {store.pnl.tbn_price_per_bale?.toFixed(2)}{' TND/bale\n'}
              {'Market price: '}{store.pnl.market_series}{' · '}
              {store.pnl.estimated_value != null ? Math.round(store.pnl.estimated_value).toLocaleString('fr-TN') : '—'}{' TND/head'}
            </Text>
          </>
        ) : (
          <Text style={[styles.pnlNoPriceText, { color: colors.textSecondary }]}>
            Could not load P&L data
          </Text>
        )}
      </View>

      {/* Health history card */}
      <View style={[styles.healthCard, { backgroundColor: colors.card }]}>
        <View style={styles.healthTitleRow}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
            🏥 Health History
          </Text>
          <Pressable
            style={[styles.addEventBtn, { backgroundColor: GREEN }]}
            onPress={() => setShowHealthModal(true)}>
            <Text style={styles.addEventBtnText}>＋ Event</Text>
          </Pressable>
        </View>

        {store.healthEvents.length === 0 ? (
          <Text style={[styles.noEventsText, { color: colors.textSecondary }]}>
            No health events recorded
          </Text>
        ) : (
          store.healthEvents.map(event => {
            const ec = EVENT_COLORS[event.event_type] ?? EVENT_COLORS.other;
            const label = HEALTH_EVENT_TYPES.find(t => t.value === event.event_type)?.label
              ?? event.event_type;
            return (
              <View key={event.id} style={styles.healthEventRow}>
                <View>
                  <View style={[styles.eventBadge, { backgroundColor: ec.bg }]}>
                    <Text style={[styles.eventBadgeText, { color: ec.text }]}>{label}</Text>
                  </View>
                  {event.description ? (
                    <Text style={[styles.eventDesc, { color: colors.textSecondary }]}>
                      {event.description}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.eventBody]} />
                <View style={styles.eventRight}>
                  <Text style={[styles.eventDate, { color: colors.textSecondary }]}>
                    {formatDate(event.event_date)}
                  </Text>
                  <Pressable style={styles.deleteEventBtn} onPress={() => handleDeleteEvent(event)}>
                    <Text style={styles.deleteEventIcon}>🗑</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
    </>
  ) : null;

  // ── RENDER ─────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, {
        paddingTop: insets.top + 8,
        backgroundColor: colors.background,
        borderBottomColor: colors.headerBorder,
      }]}>
        <TouchableOpacity onPress={() => useDrawerStore.getState().openDrawer()}>
          <Text style={[styles.hamburger, { color: colors.text }]}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>Agrio</Text>
        </View>
        <Text style={[styles.headerRight, { color: colors.textSecondary }]}>Livestock</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {view === 'list' ? listView : detailView}
      </ScrollView>

      <TabBar active="Livestock" />

      {/* Add / Edit animal modal */}
      <AnimalModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => { if (farmId) store.fetchHerdStats(farmId); }}
        initial={null}
        farmId={farmId}
      />
      <AnimalModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        initial={store.selectedAnimal}
        farmId={farmId}
      />

      {/* Add health event modal */}
      {store.selectedAnimal && (
        <HealthEventModal
          visible={showHealthModal}
          onClose={() => setShowHealthModal(false)}
          animalId={store.selectedAnimal.id}
          farmId={farmId}
        />
      )}
    </View>
  );
}
