import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, SafeAreaView, Animated, Easing, AccessibilityInfo, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AbyssPill } from '@/components/abyss-pill';

/**
 * The first screen in the Abyss style, after Shakuro's "Finance Mobile Banking
 * App" start screen (Dribbble 26139144, picked 28 Oct 2026): a black page, one
 * large picture in the top half fading into it, the name set big and light at
 * the bottom left, one grey line, and a slim pill button with an arrow.
 * The picture is EMC's own robot (assets/images/emc-robot-hero.jpg: the app
 * icon with its grey ground taken down to black, set on a larger black canvas
 * and faded to pure black at every edge, so the glow is never cut off).
 * The description is the dev's shorter line (28 Oct 2026), replacing the old
 * paragraph; customer copy is the Boss's call before this goes live.
 *
 * Motion is slow and quiet, and skipped when the phone asks for reduced motion.
 */
const native = Platform.OS !== 'web';
// Pure black, the same as the picture's faded edges, so no box shows around it.
export const ABYSS_BLACK = '#000000';

/** Fade in and rise into place. */
export const rise = (v: Animated.Value) => ({
  opacity: v,
  transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
});

export function AbyssSplash({ onStart }: { onStart: () => void }) {
  const art = useRef(new Animated.Value(0)).current;
  const title = useRef(new Animated.Value(0)).current;
  const words = useRef(new Animated.Value(0)).current;
  const button = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        [art, title, words, button].forEach((v) => v.setValue(1));
        return;
      }
      const ease = Easing.out(Easing.cubic);
      Animated.sequence([
        Animated.timing(art, { toValue: 1, duration: 900, easing: ease, useNativeDriver: native }),
        Animated.stagger(140, [title, words, button].map((v) =>
          Animated.timing(v, { toValue: 1, duration: 600, easing: ease, useNativeDriver: native }),
        )),
      ]).start();
      // The robot hovers: a few pixels up and down, very slowly.
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
          Animated.timing(float, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        ]),
      );
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); };
  }, [art, title, words, button, float]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Animated.View
          style={[
            styles.artWrap,
            {
              opacity: art,
              transform: [
                { scale: art.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) },
                { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
              ],
            },
          ]}
        >
          <Image
            testID="splash-app-icon"
            source={require('../assets/images/emc-robot-hero.jpg')}
            style={styles.art}
            resizeMode="contain"
          />
          {/* The picture's own edges already fade to black; this only eases it
              into the words below. */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', ABYSS_BLACK]}
            locations={[0.75, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </Animated.View>

        <View style={styles.bottom}>
          <Animated.Text style={[styles.title, rise(title)]}>EA Mobile{'\n'}Connect</Animated.Text>
          <Animated.Text style={[styles.description, rise(words)]}>
            Mobile hosting for your Expert Advisors. Connect MT5, manage your EAs and stay in control from anywhere.
          </Animated.Text>
          <Animated.View style={rise(button)}>
            <AbyssPill label="Start now" onPress={onStart} testID="splash-start" />
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ABYSS_BLACK },
  inner: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },

  // Clipped only where it meets the screen's own edges; keeps the page from scrolling sideways.
  artWrap: { flex: 1, minHeight: 260, justifyContent: 'center', overflow: 'hidden' },
  // Drawn larger than its box: the picture's edges are already black, so the
  // overflow is invisible and the robot fills the top half.
  art: { width: '100%', height: '100%', transform: [{ scale: 1.3 }] },

  bottom: { paddingHorizontal: 24, paddingBottom: 26 },
  title: {
    color: '#FFFFFF', fontSize: 42, lineHeight: 46, fontWeight: '300', letterSpacing: -1.4, marginBottom: 14,
  },
  description: { color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 22, marginBottom: 28, maxWidth: 320 },
});
