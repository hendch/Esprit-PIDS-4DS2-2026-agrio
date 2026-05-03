import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../core/theme/useTheme';
import { useTutorialStore } from '../../core/tutorial/store';
import { useUserStore } from '../../core/userStore/userStore';
import { Routes } from '../../core/navigation/routes';

export function SettingsScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tutorial = useTutorialStore();
  const clearUser = useUserStore((s) => s.clearUser);

  const handleRestartTutorial = async () => {
    await tutorial.reset();
    nav.navigate(Routes.Livestock);
  };

  const handleLogout = () => {
    clearUser();
    nav.reset({ index: 0, routes: [{ name: Routes.Login }] });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.headerBorder }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={8}>
          <Text style={[styles.backBtn, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tutorial section */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TUTORIAL</Text>
        <TouchableOpacity style={styles.row} onPress={handleRestartTutorial} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>🔄</Text>
            <View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Restart Tutorial</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Go through the app tutorial again
              </Text>
            </View>
          </View>
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Account section */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>
        <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>🚪</Text>
            <Text style={[styles.rowLabel, { color: colors.severityHigh }]}>Log Out</Text>
          </View>
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>
      </View>
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
  backBtn: { fontSize: 16, fontWeight: '600', width: 60 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  section: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowIcon: { fontSize: 20, marginRight: 14 },
  rowLabel: { fontSize: 16 },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '300' },
});
