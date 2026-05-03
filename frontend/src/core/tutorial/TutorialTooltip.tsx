import React, { useEffect, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { TutorialStep } from './types';

const STEP_INSTRUCTIONS: Record<string, string> = {
  add_animal: 'Tap the green + Add button above',
  view_market_value: 'Tap an animal card, then scroll to the Market Value card',
  set_price_alert: 'Tap the green + button',
  generate_forecast: 'Select a series — the forecast loads automatically, then tap Got it below the table',
  view_recommendation: 'Scroll down to the AI Price Recommendation card, then tap Got it',
  join_community: 'Tap the ✏️ button to create a post',
};

interface Props {
  step: TutorialStep;
  stepNumber: number;
  totalSteps: number;
  onSkip: () => void;
}

export function TutorialTooltip({ step, stepNumber, totalSteps, onSkip }: Props) {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY()).current;

  // PanResponder attached only to the drag handle — Skip & dots remain tappable
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Save current position as offset so dragging starts from where card is
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        // Collapse offset+value into a single value so next drag starts correctly
        pan.flattenOffset();
      },
    }),
  ).current;

  // Reset card position when the active step changes
  useEffect(() => {
    pan.setOffset({ x: 0, y: 0 });
    pan.setValue({ x: 0, y: 0 });
  }, [step.key]);

  // Pulse animation on the instruction row
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  const isTop = step.position === 'top';

  return (
    <View
      style={[styles.container, { justifyContent: isTop ? 'flex-start' : 'flex-end' }]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: colors.card },
          isTop ? { marginTop: 88 } : { marginBottom: 90 },
          { transform: pan.getTranslateTransform() },
        ]}
      >
        {/* ── Drag handle — touch this area to move the card ── */}
        <View style={styles.dragBar} {...panResponder.panHandlers}>
          <View style={[styles.dragPill, { backgroundColor: colors.cardBorder }]} />
        </View>

        {/* Row 1: emoji + title + step counter */}
        <View style={styles.topRow}>
          <Text style={styles.emoji}>{step.emoji}</Text>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {step.title}
          </Text>
          <Text style={[styles.counter, { color: colors.textSecondary }]}>
            {stepNumber}/{totalSteps}
          </Text>
        </View>

        {/* Row 2: description */}
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {step.description}
        </Text>

        {/* Row 3: pulsing instruction */}
        <Animated.View style={{ opacity: pulseAnim, marginBottom: 12 }}>
          <Text style={[styles.hint, { color: colors.primary }]}>
            👆 {STEP_INSTRUCTIONS[step.key] ?? 'Complete this step to continue'}
          </Text>
        </Animated.View>

        {/* Row 4: skip + progress dots */}
        <View style={styles.bottomRow}>
          <Pressable onPress={onSkip} hitSlop={8}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </Pressable>
          <View style={styles.dotsRow}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i < stepNumber ? colors.primary : colors.cardBorder },
                ]}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  // Drag handle — full-width hit area with a visual pill
  dragBar: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  emoji: { fontSize: 32 },
  title: { flex: 1, fontSize: 15, fontWeight: '700' },
  counter: { fontSize: 12 },
  description: { fontSize: 13, lineHeight: 19, marginBottom: 10 },
  hint: { fontSize: 13, fontWeight: '600' },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipText: { fontSize: 13 },
  dotsRow: { flexDirection: 'row', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
