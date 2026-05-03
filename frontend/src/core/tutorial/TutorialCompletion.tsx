import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface Props {
  onClose: () => void;
}

const SUMMARY = [
  { emoji: '🐄', label: 'Animal tracking' },
  { emoji: '💰', label: 'Market value monitoring' },
  { emoji: '🔔', label: 'Price alerts' },
  { emoji: '📈', label: 'AI price forecasts' },
  { emoji: '🎯', label: 'Sell recommendations' },
  { emoji: '🌱', label: 'Community connection' },
];

export function TutorialCompletion({ onClose }: Props) {
  const { colors } = useTheme();

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <Text style={styles.celebrationEmoji}>🎉</Text>

            <Text style={[styles.title, { color: colors.text }]}>You're all set!</Text>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              You've completed the Agrio tutorial. You're ready to manage your farm like a pro.
            </Text>

            {SUMMARY.map((item) => (
              <View key={item.label} style={[styles.summaryRow, { borderBottomColor: colors.cardBorder }]}>
                <Text style={styles.summaryEmoji}>{item.emoji}</Text>
                <Text style={[styles.summaryLabel, { color: colors.text }]}>{item.label}</Text>
              </View>
            ))}

            <Pressable
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
              onPress={onClose}
            >
              <Text style={styles.doneBtnText}>Start Farming →</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    margin: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  celebrationEmoji: { fontSize: 80, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryEmoji: { fontSize: 22, marginRight: 12 },
  summaryLabel: { fontSize: 15 },
  doneBtn: {
    marginTop: 24,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
