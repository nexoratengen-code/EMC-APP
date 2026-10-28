import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Platform, SafeAreaView, Animated, Easing, AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { ABYSS } from '@/components/abyss-connect';

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
const web = Platform.OS === 'web';
const native = !web;
// Pure black, the same as the picture's faded edges, so no box shows around it.
const BLACK = '#000000';

const rise = (v: Animated.Value) => ({
  opacity: v,
  transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
});

export function AbyssSplash({ onStart }: { onStart: () => void }) {
  const art = useRef(new Animated.Value(0)).current;
  const title = useRef(new Animated.Value(0)).current;
  const words = useRef(new Animated.Value(0)).current;
  const button = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

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

  const pressTo = (v: number) =>
    Animated.spring(press, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: native }).start();

  const buttonRise = rise(button);

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
            colors={['rgba(0,0,0,0)', BLACK]}
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

          <Animated.View style={{ opacity: buttonRise.opacity, transform: [...buttonRise.transform, { scale: press }] }}>
            <StartButton
              onStart={onStart}
              onPressIn={() => pressTo(0.97)}
              onPressOut={() => pressTo(1)}
            />
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * The pill button, alive but calm: a soft light sweeps across it, the arrow
 * slides out to the right and back in from the left, and the blue circle's
 * glow breathes. One cycle every 3.6 s. Still when reduced motion is on.
 */
function StartButton({ onStart, onPressIn, onPressOut }: {
  onStart: () => void; onPressIn: () => void; onPressOut: () => void;
}) {
  const [width, setWidth] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  const arrow = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loops: Animated.CompositeAnimation[] = [];
    let cancelled = false;
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
    return () => { cancelled = true; loops.forEach((l) => l.stop()); };
  }, [sweep, arrow, glow]);

  return (
    <TouchableOpacity
      onPress={onStart}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={0.9}
      style={styles.button}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      testID="splash-start"
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

      <Text style={styles.buttonText}>Start now</Text>

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
          <Animated.View
            style={{
              opacity: arrow.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
              transform: [{ translateX: arrow.interpolate({ inputRange: [-1, 0, 1], outputRange: [-16, 0, 16] }) }],
            }}
          >
            <ArrowRight color="#FFFFFF" size={18} strokeWidth={2.4} />
          </Animated.View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BLACK },
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

  button: {
    height: 60, borderRadius: 30, paddingLeft: 24, paddingRight: 7,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0E1118', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  sweepClip: { ...StyleSheet.absoluteFillObject, borderRadius: 30, overflow: 'hidden' },
  sweep: { position: 'absolute', top: -10, bottom: -10, left: 0, width: 90 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
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
