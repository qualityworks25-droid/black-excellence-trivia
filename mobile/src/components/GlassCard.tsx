import React, { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';

interface GlassCardProps extends PropsWithChildren {
  style?: ViewStyle;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
}

/**
 * Reusable glassmorphism panel: a BlurView with a translucent tint, a subtle light
 * border, and a soft shadow. `expo-blur` alone is sufficient for this effect on iOS —
 * no separate native "glass effect" package is needed.
 *
 * Perf note: keep stacked GlassCards shallow (avoid nesting one GlassCard inside
 * another) — each BlurView is a real-time native blur pass, and stacking many of them
 * on screen at once is the main cost, not any single card's intensity.
 */
export function GlassCard({ children, style, intensity = 40, tint = 'dark' }: GlassCardProps) {
  return (
    <View style={[styles.shadowWrapper, style]}>
      <BlurView intensity={intensity} tint={tint} style={styles.blur}>
        <View style={styles.tintOverlay}>{children}</View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  blur: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tintOverlay: {
    backgroundColor: colors.glassTintLight,
    padding: 16,
  },
});
