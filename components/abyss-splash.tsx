import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Platform, SafeAreaView, Animated, Easing, AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ABYSS } from '@/components/abyss-connect';

/**
 * The first screen in the Abyss style, after Conceptzilla's "Abyss" start
 * screen: one tall frosted blue glass panel with the mark at the top and the
 * name set large at the bottom, and a single solid blue START NOW under it.
 * Same words as the old splash; only the look changed.
 *
 * Motion is slow and quiet: the panel rises in, the name, the words and the
 * button follow in turn, and the light inside the glass drifts. All of it is
 * skipped when the phone asks for reduced motion.
 */
const web = Platform.OS === 'web';
const native = !web;

/** Fade in and rise into place. */
const rise = (v: Animated.Value) => ({
  opacity: v,
  transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
});

export function AbyssSplash({ onStart }: { onStart: () => void }) {
  const panel = useRef(new Animated.Value(0)).current;
  const title = useRef(new Animated.Value(0)).current;
  const words = useRef(new Animated.Value(0)).current;
  const button = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        [panel, title, words, button].forEach((v) => v.setValue(1));
        return;
      }
      const ease = Easing.out(Easing.cubic);
      Animated.stagger(140, [
        Animated.timing(panel, { toValue: 1, duration: 700, easing: ease, useNativeDriver: native }),
        Animated.timing(title, { toValue: 1, duration: 600, easing: ease, useNativeDriver: native }),
        Animated.timing(words, { toValue: 1, duration: 600, easing: ease, useNativeDriver: native }),
        Animated.timing(button, { toValue: 1, duration: 600, easing: ease, useNativeDriver: native }),
      ]).start();
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(drift, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
          Animated.timing(drift, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        ]),
      );
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); };
  }, [panel, title, words, button, drift]);

  const pressTo = (v: number) =>
    Animated.spring(press, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: native }).start();

  const buttonRise = rise(button);

  return (
    <SafeAreaView
      style={[
        styles.container,
        web && ({
          backgroundImage: `radial-gradient(ellipse 80% 40% at 50% 100%, rgba(${ABYSS.blueRgb}, 0.22) 0%, transparent 70%)`,
        } as any),
      ]}
    >
      <View style={styles.inner}>
        <Animated.View style={[styles.panelWrap, rise(panel)]}>
          <LinearGradient
            colors={['#6A93FF', '#2F58E0', '#1A2A7A', '#0F1636']}
            locations={[0, 0.35, 0.75, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.panel}
          >
            {/* Soft light pooled in the upper left, the frosted look of the reference. */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bloom,
                {
                  transform: [
                    { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-24, 36] }) },
                    { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [-10, 28] }) },
                    { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
                  ],
                },
                web && ({
                  backgroundImage: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 35%, transparent 65%)',
                  filter: 'blur(8px)',
                } as any),
              ]}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.sheen}
              pointerEvents="none"
            />

            <View style={styles.markRow}>
              <Image
                testID="splash-app-icon"
                source={require('../assets/images/icon.png')}
                style={styles.mark}
                resizeMode="contain"
              />
            </View>

            <View>
              <Animated.Text style={[styles.title, rise(title)]}>EA Mobile{'\n'}Connect</Animated.Text>
              <Animated.Text style={[styles.description, rise(words)]}>
                A cutting-edge mobile hosting platform designed to empower traders with a secure, reliable, and user-friendly environment for running their automated trading systems. Seamlessly manage your Expert Advisors (EAs) on the go, ensuring optimal performance and peace of mind.
              </Animated.Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={{ opacity: buttonRise.opacity, transform: [...buttonRise.transform, { scale: press }] }}>
          <TouchableOpacity
            onPress={onStart}
            onPressIn={() => pressTo(0.96)}
            onPressOut={() => pressTo(1)}
            activeOpacity={0.9}
            style={[styles.button, web && ({ boxShadow: `0 12px 34px rgba(${ABYSS.blueRgb}, 0.4)` } as any)]}
            testID="splash-start"
          >
            <Text style={styles.buttonText}>START NOW</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ABYSS.ground },
  inner: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', padding: 14, paddingBottom: 22 },

  panelWrap: { flex: 1, marginBottom: 16 },
  panel: {
    flex: 1, borderRadius: 34, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 26, paddingTop: 28, paddingBottom: 30, justifyContent: 'space-between',
  },
  bloom: { position: 'absolute', top: -40, left: -40, right: -40, height: '70%' },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },

  markRow: { alignItems: 'center' },
  mark: {
    width: 64, height: 64, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },

  title: {
    color: '#FFFFFF', fontSize: 46, lineHeight: 50, fontWeight: '600', letterSpacing: -1.2, marginBottom: 16,
  },
  description: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 21 },

  button: {
    height: 58, borderRadius: 18, backgroundColor: ABYSS.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1.6 },
});
