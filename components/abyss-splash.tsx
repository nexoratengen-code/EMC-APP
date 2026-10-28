import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ABYSS } from '@/components/abyss-connect';

/**
 * The first screen in the Abyss style, after Conceptzilla's "Abyss" start
 * screen: one tall frosted blue glass panel with the mark at the top and the
 * name set large at the bottom, and a single solid blue START NOW under it.
 * Same words as the old splash; only the look changed.
 */
const web = Platform.OS === 'web';

export function AbyssSplash({ onStart }: { onStart: () => void }) {
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
        <LinearGradient
          colors={['#6A93FF', '#2F58E0', '#1A2A7A', '#0F1636']}
          locations={[0, 0.35, 0.75, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.panel}
        >
          {/* Soft light pooled in the upper left, the frosted look of the reference. */}
          <View
            pointerEvents="none"
            style={[
              styles.bloom,
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

          <View style={styles.copy}>
            <Text style={styles.title}>EA Mobile{'\n'}Connect</Text>
            <Text style={styles.description}>
              A cutting-edge mobile hosting platform designed to empower traders with a secure, reliable, and user-friendly environment for running their automated trading systems. Seamlessly manage your Expert Advisors (EAs) on the go, ensuring optimal performance and peace of mind.
            </Text>
          </View>
        </LinearGradient>

        <TouchableOpacity
          onPress={onStart}
          activeOpacity={0.85}
          style={[styles.button, web && ({ boxShadow: `0 12px 34px rgba(${ABYSS.blueRgb}, 0.4)` } as any)]}
          testID="splash-start"
        >
          <Text style={styles.buttonText}>START NOW</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ABYSS.ground },
  inner: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', padding: 14, paddingBottom: 22 },

  panel: {
    flex: 1, borderRadius: 34, overflow: 'hidden', marginBottom: 16,
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

  copy: {},
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
