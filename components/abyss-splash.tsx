import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, SafeAreaView, Animated, Platform, Image, Easing, AccessibilityInfo } from 'react-native';
import { LUX, LuxMark, LuxPill, LuxRule, rise, useEntrance } from '@/components/abyss-lux';

/**
 * The first screen, minimal luxury (dev's pick, 28 Oct 2026): a black page,
 * the small silver EMC mark at the top, EMC's robot with its glow floating in
 * the open middle (dev's ask, same day), the name set huge and thin at the
 * bottom left, one hairline, one short line, and a white pill.
 *
 * The robot is assets/images/emc-robot-glow.png: the app icon with its grey
 * ground levelled to black, every edge faded out, and the black then made
 * transparent (alpha = brightest channel, colour un-premultiplied), so the
 * glow sits on whatever is behind it with no box, on web and on phones.
 *
 * The line is the first sentence of the dev's shorter copy; customer copy is
 * the Boss's call before this goes live.
 */
const web = Platform.OS === 'web';
const native = !web;
export const ABYSS_BLACK = LUX.black;
export { rise };

export function AbyssSplash({ onStart }: { onStart: () => void }) {
  const [mark, art, line1, line2, rule, words, button] = useEntrance(7, { delay: 140, duration: 900, first: 200 });
  const float = useRef(new Animated.Value(0)).current;

  // The robot hovers: a few pixels up and down, very slowly.
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(float, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]));
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); };
  }, [float]);

  return (
    <SafeAreaView
      style={[
        styles.container,
        // A breath of light high on the right, so the black has depth rather than being flat.
        web && ({
          backgroundImage: 'radial-gradient(ellipse 70% 45% at 85% 0%, rgba(255,255,255,0.07) 0%, transparent 70%)',
        } as any),
      ]}
    >
      <View style={styles.inner}>
        <Animated.View style={[styles.top, { opacity: mark }]}>
          <LuxMark />
        </Animated.View>

        <Animated.View
          style={[
            styles.artWrap,
            {
              opacity: art,
              transform: [
                { scale: art.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Image
            testID="splash-app-icon"
            source={require('../assets/images/emc-robot-glow.png')}
            style={styles.art}
            resizeMode="contain"
          />
        </Animated.View>

        <View>
          <Animated.Text style={[styles.title, rise(line1, 22)]}>EA Mobile</Animated.Text>
          <Animated.Text style={[styles.title, rise(line2, 22)]}>Connect</Animated.Text>
          <LuxRule progress={rule} />
          <Animated.Text style={[styles.line, rise(words)]}>Mobile hosting for your Expert Advisors.</Animated.Text>
          <Animated.View style={[styles.button, rise(button)]}>
            <LuxPill label="Start now" onPress={onStart} testID="splash-start" />
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LUX.black },
  inner: {
    flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center',
    paddingHorizontal: 28, paddingTop: 22, paddingBottom: 30,
  },
  top: { paddingTop: 6 },
  // Fills whatever room the page has between the mark and the name.
  // Clipping is invisible: the picture's edges are already pure black.
  artWrap: {
    flex: 1, minHeight: 180, marginHorizontal: -28, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  art: { width: '100%', height: '100%', transform: [{ scale: 1.15 }] },
  title: { color: LUX.white, fontSize: 54, lineHeight: 58, fontWeight: '200', letterSpacing: -2 },
  line: { color: LUX.grey, fontSize: 16, lineHeight: 24, fontWeight: '300' },
  button: { marginTop: 44 },
});
