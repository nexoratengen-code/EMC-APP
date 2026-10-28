import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Easing, AccessibilityInfo, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { ABYSS } from '@/components/abyss-connect';

/**
 * The Abyss pill button (start page, sign in): label on the left, a blue
 * circle with an arrow on the right. Alive but calm: a soft light sweeps
 * across it, the arrow slides out to the right and back in from the left,
 * and the circle's glow breathes, one cycle every 3.6 s. It presses in a
 * little when tapped. Still when reduced motion is on, and while busy.
 */
const web = Platform.OS === 'web';
const native = !web;

type Props = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  busyLabel?: string;
  testID?: string;
};

export function AbyssPill({ label, onPress, busy = false, busyLabel, testID }: Props) {
  const [width, setWidth] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  const arrow = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loops: Animated.CompositeAnimation[] = [];
    let cancelled = false;
    if (busy) return;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled || reduce) return;
      const ease = Easing.inOut(Easing.cubic);
      loops = [
        Animated.loop(Animated.sequence([
          Animated.delay(1200),
          Animated.timing(sweep, { toValue: 1, duration: 1400, easing: ease, useNativeDriver: native }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: native }),
          Animated.delay(1000),
        ])),
        Animated.loop(Animated.sequence([
          Animated.delay(1600),
          Animated.timing(arrow, { toValue: 1, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: native }),
          Animated.timing(arrow, { toValue: -1, duration: 0, useNativeDriver: native }),
          Animated.timing(arrow, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
          Animated.delay(1200),
        ])),
        Animated.loop(Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
          Animated.timing(glow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        ])),
      ];
      loops.forEach((l) => l.start());
    });
    return () => {
      cancelled = true;
      loops.forEach((l) => l.stop());
      [sweep, arrow].forEach((v) => v.setValue(0));
    };
  }, [busy, sweep, arrow, glow]);

  const pressTo = (v: number) =>
    Animated.spring(press, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: native }).start();

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => pressTo(0.97)}
        onPressOut={() => pressTo(1)}
        disabled={busy}
        activeOpacity={0.9}
        style={[styles.button, busy && { opacity: 0.75 }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="button"
        testID={testID}
      >
        {/* The sweep has its own clipped layer, so the arrow's glow can still spill out. */}
        {width > 0 && (
          <View style={styles.sweepClip} pointerEvents="none">
            <Animated.View
              style={[
                styles.sweep,
                { transform: [
                  { translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-120, width + 40] }) },
                  { skewX: '-20deg' },
                ] },
              ]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        )}

        <Text style={styles.label}>{busy && busyLabel ? busyLabel : label}</Text>

        <View style={styles.arrowSlot}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.arrowGlow,
              {
                opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }),
                transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }],
              },
            ]}
          />
          <View style={styles.arrow}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Animated.View
                style={{
                  opacity: arrow.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
                  transform: [{ translateX: arrow.interpolate({ inputRange: [-1, 0, 1], outputRange: [-16, 0, 16] }) }],
                }}
              >
                <ArrowRight color="#FFFFFF" size={18} strokeWidth={2.4} />
              </Animated.View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 60, borderRadius: 30, paddingLeft: 24, paddingRight: 7,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0E1118', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  sweepClip: { ...StyleSheet.absoluteFillObject, borderRadius: 30, overflow: 'hidden' },
  sweep: { position: 'absolute', top: -10, bottom: -10, left: 0, width: 90 },
  label: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  arrowSlot: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  arrowGlow: {
    position: 'absolute', width: 46, height: 46, borderRadius: 23, backgroundColor: ABYSS.blue,
    ...(web ? ({ filter: 'blur(10px)' } as any) : null),
  },
  arrow: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: ABYSS.blue,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
});
