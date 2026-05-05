import { StyleSheet } from 'react-native';

export const GREEN       = '#4CAF50';
export const GREEN_LIGHT = '#E8F5E9';
export const BLUE        = '#1E88E5';
export const BLUE_LIGHT  = '#E3F2FD';

export const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  hamburger: { fontSize: 22 },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  logoIcon: { fontSize: 24, marginRight: 6 },
  logoText: { fontSize: 20, fontWeight: '700', color: GREEN },
  headerRight: { fontSize: 14, fontWeight: '500' },

  // ── Scroll ──────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },

  // ── List header row ─────────────────────────────────────────────────
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  listTitle: { fontSize: 22, fontWeight: '800' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // ── Filter pills ─────────────────────────────────────────────────────
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#F5F5F5',
  },
  filterPillActive: { backgroundColor: BLUE_LIGHT, borderColor: BLUE },
  filterPillText: { fontSize: 13, color: '#555', fontWeight: '500' },
  filterPillTextActive: { color: BLUE, fontWeight: '700' },

  // ── Herd stats card ──────────────────────────────────────────────────
  statsCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C9E0FF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statsBox: {
    flex: 1,
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1565C0',
  },
  statsLabel: {
    fontSize: 11,
    color: '#555',
    marginTop: 2,
    textAlign: 'center',
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#C9E0FF',
    marginVertical: 12,
  },
  statsWarning: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },

  // ── Empty state ──────────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // ── Animal card ──────────────────────────────────────────────────────
  animalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  animalEmojiCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: GREEN_LIGHT,
  },
  animalEmoji: { fontSize: 26 },
  animalBody: { flex: 1 },
  animalNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  animalName: { fontSize: 16, fontWeight: '700', flex: 1 },
  animalSubtitle: { fontSize: 13, marginBottom: 2 },
  animalMeta: { fontSize: 12 },
  chevron: { fontSize: 20, marginLeft: 8 },

  // Status badges
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },

  // ── Detail view ──────────────────────────────────────────────────────
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 4 },
  backText: { fontSize: 15, fontWeight: '600' },

  // Info card
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  infoEmoji: { fontSize: 32, marginRight: 10 },
  infoAnimalName: { fontSize: 20, fontWeight: '800', flex: 1 },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  editBtnText: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 14 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoChip: {
    width: '47%',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 10,
  },
  infoChipLabel: { fontSize: 11, marginBottom: 3 },
  infoChipValue: { fontSize: 14, fontWeight: '600' },

  // Market price card
  marketCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  marketPrice: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  marketSeries: { fontSize: 13, marginBottom: 8 },
  marketGrowth: { fontSize: 13, fontWeight: '600', color: GREEN, marginBottom: 14 },
  marketBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  marketBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  noMarketText: { fontSize: 14, textAlign: 'center', paddingVertical: 8 },

  // P&L card
  pnlCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  pnlMetricRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 14,
  },
  pnlMetricBox: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 10,
  },
  pnlMetricLabel: {
    fontSize: 10,
    color: '#888',
    marginBottom: 3,
  },
  pnlMetricValue: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  pnlMetricSub: {
    fontSize: 10,
    color: '#999',
    marginTop: 3,
  },
  pnlDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 14,
  },
  pnlSummaryRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 12,
  },
  pnlSummaryBox: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center' as const,
  },
  pnlSummaryValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  pnlSummarySubLabel: {
    fontSize: 11,
    color: '#777',
    textAlign: 'center' as const,
  },
  pnlFootnote: {
    fontSize: 11,
    color: '#AAA',
    lineHeight: 18,
  },
  pnlDisclaimer: {
    fontSize: 11,
    color: '#BBBBBB',
    lineHeight: 17,
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  pnlNoPriceText: {
    fontSize: 14,
    textAlign: 'center' as const,
    paddingVertical: 8,
  },
  addPriceBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center' as const,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  addPriceBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#555',
  },

  // Health section
  healthCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  healthTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addEventBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addEventBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  noEventsText: { fontSize: 14, textAlign: 'center', paddingVertical: 12 },

  healthEventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 10,
  },
  eventBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  eventBadgeText: { fontSize: 12, fontWeight: '600' },
  eventBody: { flex: 1 },
  eventDesc: { fontSize: 12, marginTop: 3, lineHeight: 18 },
  eventRight: { alignItems: 'flex-end', gap: 4 },
  eventDate: { fontSize: 12 },
  deleteEventBtn: { padding: 2 },
  deleteEventIcon: { fontSize: 16 },

  // ── Modal shared ─────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { fontSize: 22, padding: 4 },
  formLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  formHint: { fontSize: 11, marginTop: 4 },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  textInputMulti: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 70,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#F5F5F5',
  },
  pillActive: { borderColor: BLUE, backgroundColor: BLUE_LIGHT },
  pillText: { fontSize: 13, color: '#555' },
  pillTextActive: { color: BLUE, fontWeight: '700' },
  saveBtn: {
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  modalError: { fontSize: 13, color: '#C62828', marginTop: 10, textAlign: 'center' },

  // ── Tab bar ──────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
  },
  tabItem: { alignItems: 'center', flex: 1 },
  tabIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  tabIconWrapActive: { backgroundColor: GREEN_LIGHT },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 10 },
  tabLabelActive: { color: GREEN, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});

// Health event badge colours
export const EVENT_COLORS: Record<string, { bg: string; text: string }> = {
  vaccination: { bg: '#E3F2FD', text: '#1565C0' },
  treatment:   { bg: '#FFF3E0', text: '#E65100' },
  checkup:     { bg: '#E8F5E9', text: '#2E7D32' },
  injury:      { bg: '#FFEBEE', text: '#C62828' },
  illness:     { bg: '#F3E5F5', text: '#6A1B9A' },
  other:       { bg: '#F5F5F5', text: '#757575' },
};

// Status badge colours
export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:   { bg: '#E8F5E9', text: '#2E7D32' },
  sold:     { bg: '#F5F5F5', text: '#757575' },
  deceased: { bg: '#FFEBEE', text: '#C62828' },
};
