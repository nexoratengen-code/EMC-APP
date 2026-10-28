import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Easing, AccessibilityInfo, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Minimal luxury pieces for EMC's Abyss style (dev's pick, 28 Oct 2026, after
 * the robot hero read as clipart): monochrome, huge thin type, hairlines, a
 * small silver mark and a white pill. The Apple Card / Revolut Metal register.
 */
const web = Platform.OS === 'web';
const native = !web;

export const LUX = {
  black: '#000000',
  white: '#FFFFFF',
  silver: 'rgba(255,255,255,0.72)',
  grey: 'rgba(255,255,255,0.48)',
  faint: 'rgba(255,255,255,0.28)',
  hairline: 'rgba(255,255,255,0.18)',
};

/** Fade in and rise into place. */
export const rise = (v: Animated.Value, by = 14) => ({
  opacity: v,
  transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [by, 0] }) }],
});

/** Staggered entrance for a list of values; instant when reduced motion is on. */
export function useEntrance(count: number, { delay = 120, duration = 700, first = 150 } = {}) {
  const values = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      if (reduce) { values.forEach((v) => v.setValue(1)); return; }
      Animated.sequence([
        Animated.delay(first),
        Animated.stagger(delay, values.map((v) =>
          Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
        )),
      ]).start();
    });
    return () => { cancelled = true; };
  }, [values, delay, duration, first]);
  return values;
}

/** The small silver mark: a hairline ring with a point of light, and EMC. */
export function LuxMark() {
  return (
    <View style={styles.markRow}>
      <View style={styles.ring}>
        <View style={styles.dot} />
      </View>
      <Text style={styles.markText}>EMC</Text>
    </View>
  );
}

/** One hairline that draws itself in from the left. */
export function LuxRule({ progress, width = 56 }: { progress: Animated.Value; width?: number }) {
  return (
    <View style={{ width, height: 1, overflow: 'hidden', marginVertical: 22 }}>
      <Animated.View
        style={{
          width, height: 1, backgroundColor: 'rgba(255,255,255,0.45)',
          transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) }],
        }}
      />
    </View>
  );
}

/**
 * The white pill: black words, centred. Its only motion is a slow sheen that
 * crosses it every few seconds, and a small give when pressed.
 */
export function LuxPill({ label, onPress, busy = false, busyLabel, testID }: {
  label: string; onPress: () => void; busy?: boolean; busyLabel?: string; testID?: string;
}) {
  const [width, setWidth] = useState(0);
  const sheen = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    if (busy) return;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.delay(2400),
        Animated.timing(sheen, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }),
        Animated.timing(sheen, { toValue: 0, duration: 0, useNativeDriver: native }),
      ]));
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); sheen.setValue(0); };
  }, [busy, sheen]);

  const pressTo = (v: number) =>
    Animated.spring(press, { toValue: v, speed: 40, bounciness: 4, useNativeDriver: native }).start();

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => pressTo(0.98)}
        onPressOut={() => pressTo(1)}
        disabled={busy}
        activeOpacity={0.92}
        style={[styles.pill, busy && { opacity: 0.8 }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="button"
        testID={testID}
      >
        {width > 0 && (
          <View style={styles.sheenClip} pointerEvents="none">
            <Animated.View
              style={[styles.sheen, { transform: [
                { translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-140, width + 60] }) },
                { skewX: '-20deg' },
              ] }]}
            >
              <LinearGradient
                colors={['rgba(150,170,210,0)', 'rgba(150,170,210,0.28)', 'rgba(150,170,210,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        )}
        {busy ? (
          <View style={styles.row}>
            <ActivityIndicator color="#000000" size="small" />
            <Text style={styles.pillText}>{busyLabel ?? label}</Text>
          </View>
        ) : (
          <Text style={styles.pillText}>{label}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ring: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  dot: {
    width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF',
    ...(web ? ({ boxShadow: '0 0 8px rgba(255,255,255,0.9)' } as any) : null),
  },
  markText: { color: LUX.silver, fontSize: 12, fontWeight: '500', letterSpacing: 4 },

  pill: {
    height: 58, borderRadius: 29, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  sheenClip: { ...StyleSheet.absoluteFillObject, borderRadius: 29, overflow: 'hidden' },
  sheen: { position: 'absolute', top: -10, bottom: -10, left: 0, width: 110 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pillText: { color: '#000000', fontSize: 16, fontWeight: '500', letterSpacing: 0.2 },
});
