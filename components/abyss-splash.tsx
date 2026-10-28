import React from 'react';
import { View, StyleSheet, SafeAreaView, Animated, Platform } from 'react-native';
import { LUX, LuxMark, LuxPill, LuxRule, rise, useEntrance } from '@/components/abyss-lux';

/**
 * The first screen, minimal luxury (dev's pick, 28 Oct 2026, after the robot
 * hero read as clipart): a black page, the small silver EMC mark at the top,
 * the name set huge and thin at the bottom left, one hairline, one short
 * line, and a white pill. Nothing else.
 *
 * The line is the first sentence of the dev's shorter copy; customer copy is
 * the Boss's call before this goes live.
 */
export const ABYSS_BLACK = LUX.black;
export { rise };

export function AbyssSplash({ onStart }: { onStart: () => void }) {
  const [mark, line1, line2, rule, words, button] = useEntrance(6, { delay: 140, duration: 900, first: 200 });

  return (
    <SafeAreaView
      style={[
        styles.container,
        // A breath of light high on the right, so the black has depth rather than being flat.
        Platform.OS === 'web' && ({
          backgroundImage: 'radial-gradient(ellipse 70% 45% at 85% 0%, rgba(255,255,255,0.07) 0%, transparent 70%)',
        } as any),
      ]}
    >
      <View style={styles.inner}>
        <Animated.View style={[styles.top, { opacity: mark }]}>
          <LuxMark />
        </Animated.View>

        <View>
          <Animated.Text style={[styles.title, rise(line1, 22)]} testID="splash-app-icon">EA Mobile</Animated.Text>
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
    paddingHorizontal: 28, paddingTop: 22, paddingBottom: 30, justifyContent: 'space-between',
  },
  top: { paddingTop: 6 },
  title: { color: LUX.white, fontSize: 54, lineHeight: 58, fontWeight: '200', letterSpacing: -2 },
  line: { color: LUX.grey, fontSize: 16, lineHeight: 24, fontWeight: '300' },
  button: { marginTop: 44 },
});
