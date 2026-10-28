import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Image, Linking,
  Platform, KeyboardAvoidingView, ScrollView, Animated, Easing, AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ABYSS } from '@/components/abyss-connect';
import { AbyssPill } from '@/components/abyss-pill';
import { ABYSS_BLACK, rise } from '@/components/abyss-splash';

/**
 * Sign in, in the Abyss style, matching the start page (Shakuro layout): black
 * page, the robot at the top, the heading big and light, dark rounded fields
 * with no box around them, and the same animated pill button.
 *
 * Presentation only: app/login.tsx keeps the whole check (mentor + email,
 * paywall, used-email lock) and passes values and handlers in. Same words as
 * the old screen.
 */
const web = Platform.OS === 'web';
const native = !web;

type Props = {
  mentorId: string;
  setMentorId: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  isLoading: boolean;
  isPaymentProcessing: boolean;
  onProceed: () => void;
  modal: { visible: boolean; title: string; message: string };
  onDismissModal: () => void;
  onReactivate: () => void;
};

export function AbyssLogin(p: Props) {
  const [focus, setFocus] = useState<'mentor' | 'email' | null>(null);
  const art = useRef(new Animated.Value(0)).current;
  const head = useRef(new Animated.Value(0)).current;
  const form = useRef(new Animated.Value(0)).current;
  const foot = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      if (reduce) { [art, head, form, foot].forEach((v) => v.setValue(1)); return; }
      const ease = Easing.out(Easing.cubic);
      Animated.sequence([
        Animated.timing(art, { toValue: 1, duration: 700, easing: ease, useNativeDriver: native }),
        Animated.stagger(130, [head, form, foot].map((v) =>
          Animated.timing(v, { toValue: 1, duration: 600, easing: ease, useNativeDriver: native }),
        )),
      ]).start();
      loop = Animated.loop(Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(float, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]));
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); };
  }, [art, head, form, foot, float]);

  const field = (name: 'mentor' | 'email') => [
    styles.field,
    focus === name && { borderColor: ABYSS.blue },
    web && focus === name && ({ boxShadow: `0 0 0 3px rgba(${ABYSS.blueRgb}, 0.18)` } as any),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View
            style={[
              styles.artWrap,
              {
                opacity: art,
                transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
              },
            ]}
          >
            <Image source={require('@/assets/images/emc-robot-hero.jpg')} style={styles.art} resizeMode="contain" />
            <LinearGradient
              colors={['rgba(0,0,0,0)', ABYSS_BLACK]}
              locations={[0.7, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </Animated.View>

          <Animated.View style={[styles.head, rise(head)]}>
            <Text style={styles.kicker}>EA MOBILE CONNECT</Text>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.tagline}>Algorithmic Trading Platform</Text>
          </Animated.View>

          <Animated.View style={rise(form)}>
            <Text style={styles.label}>Mentor ID</Text>
            <View style={field('mentor')}>
              <TextInput
                style={styles.input}
                placeholder="Enter your mentor ID"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={p.mentorId}
                onChangeText={p.setMentorId}
                autoCapitalize="none"
                onFocus={() => setFocus('mentor')}
                onBlur={() => setFocus(null)}
                testID="abyss-mentor"
              />
            </View>

            <Text style={styles.label}>Email</Text>
            <View style={field('email')}>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={p.email}
                onChangeText={p.setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                onFocus={() => setFocus('email')}
                onBlur={() => setFocus(null)}
                onSubmitEditing={p.onProceed}
                testID="abyss-email"
              />
            </View>

            <View style={styles.buttonGap}>
              <AbyssPill
                label="Continue"
                onPress={p.onProceed}
                busy={p.isLoading || p.isPaymentProcessing}
                busyLabel={p.isLoading ? 'Verifying...' : 'Processing...'}
                testID="abyss-continue"
              />
            </View>
          </Animated.View>

          <Animated.View style={[styles.foot, rise(foot)]}>
            <View style={styles.legalRow}>
              <TouchableOpacity onPress={() => Linking.openURL('https://eamobileconnect.com/admin/info/about/terms.php').catch(() => {})}>
                <Text style={styles.legalLink}>Terms & Conditions</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>·</Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://eamobileconnect.com/admin/info/about/privacy.php').catch(() => {})}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.footer}>Powered by EA Mobile Connect</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {p.modal.visible && (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalIcon}>
              <Text style={styles.modalIconText}>!</Text>
            </View>
            <Text style={styles.modalTitle}>{p.modal.title}</Text>
            <Text style={styles.modalMessage}>{p.modal.message}</Text>
            <TouchableOpacity style={styles.quietButton} onPress={p.onDismissModal} activeOpacity={0.8}>
              <Text style={styles.quietText}>Dismiss</Text>
            </TouchableOpacity>
            {p.modal.title === 'Email Already Used' && (
              <View style={{ marginTop: 10 }}>
                <AbyssPill label="Reactivate Account" onPress={p.onReactivate} />
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ABYSS_BLACK },
  flex: { flex: 1 },
  content: {
    flexGrow: 1, paddingHorizontal: 24, paddingBottom: 26,
    width: '100%', maxWidth: 480, alignSelf: 'center',
  },

  artWrap: { height: 230, marginHorizontal: -24, justifyContent: 'center', overflow: 'hidden' },
  art: { width: '100%', height: '100%', transform: [{ scale: 1.25 }] },

  head: { marginBottom: 26 },
  kicker: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600', letterSpacing: 2, marginBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 38, lineHeight: 42, fontWeight: '300', letterSpacing: -1.2 },
  tagline: { color: 'rgba(255,255,255,0.55)', fontSize: 15, marginTop: 8 },

  label: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '500', marginBottom: 8 },
  field: {
    flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 18, paddingHorizontal: 18,
    backgroundColor: '#0E1118', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', marginBottom: 16,
  },
  input: { flex: 1, color: '#FFFFFF', fontSize: 16, ...(web ? ({ outlineStyle: 'none' } as any) : null) },
  buttonGap: { marginTop: 10 },

  foot: { marginTop: 'auto', paddingTop: 28 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 8 },
  legalLink: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' },
  legalDot: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  footer: { color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center' },

  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 24,
    backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    width: '100%', maxWidth: 380, backgroundColor: '#0E1118', borderRadius: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 22,
  },
  modalIcon: {
    width: 44, height: 44, borderRadius: 22, alignSelf: 'center', marginBottom: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: `rgba(${ABYSS.blueRgb}, 0.15)`, borderWidth: 1, borderColor: `rgba(${ABYSS.blueRgb}, 0.35)`,
  },
  modalIconText: { color: '#7FA2FF', fontSize: 20, fontWeight: '800' },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '400', textAlign: 'center', marginBottom: 8 },
  modalMessage: { color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 18 },
  quietButton: {
    height: 52, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  quietText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
});
