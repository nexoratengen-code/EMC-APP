import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, Image, Linking,
  Platform, KeyboardAvoidingView, ScrollView, Animated, Easing, AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ABYSS } from '@/components/abyss-connect';

/**
 * Sign in, in the Abyss style. Presentation only: the login screen keeps the
 * whole check (mentor + email, paywall, used-email lock) and passes values
 * and handlers in. Same words as the old screen.
 */
const web = Platform.OS === 'web';
const native = !web;

const rise = (v: Animated.Value) => ({
  opacity: v,
  transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
});

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
  const hero = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const foot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      if (reduce) { [hero, card, foot].forEach((v) => v.setValue(1)); return; }
      const ease = Easing.out(Easing.cubic);
      Animated.stagger(140, [hero, card, foot].map((v) =>
        Animated.timing(v, { toValue: 1, duration: 650, easing: ease, useNativeDriver: native }),
      )).start();
    });
    return () => { cancelled = true; };
  }, [hero, card, foot]);

  const busy = p.isLoading || p.isPaymentProcessing;

  const field = (name: 'mentor' | 'email') => [
    styles.field,
    focus === name && { borderColor: ABYSS.blue },
    web && focus === name && ({ boxShadow: `0 0 0 3px rgba(${ABYSS.blueRgb}, 0.18)` } as any),
  ];

  return (
    <SafeAreaView
      style={[
        styles.container,
        web && ({
          backgroundImage: `radial-gradient(ellipse 90% 45% at 50% 0%, rgba(${ABYSS.blueRgb}, 0.30) 0%, rgba(${ABYSS.blueRgb}, 0.08) 45%, transparent 75%)`,
        } as any),
      ]}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={rise(hero)}>
            <LinearGradient
              colors={['#5B86FF', '#2A4FCC', '#141D45']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.6, y: 1 }}
              style={styles.hero}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.sheen}
                pointerEvents="none"
              />
              <Image source={require('@/assets/images/icon.png')} style={styles.mark} resizeMode="contain" />
              <Text style={styles.appName}>EA Mobile Connect</Text>
              <Text style={styles.tagline}>Algorithmic Trading Platform</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={[styles.card, rise(card)]}>
            <Text style={styles.welcome}>Welcome Back</Text>

            <Text style={styles.label}>Mentor ID</Text>
            <View style={field('mentor')}>
              <TextInput
                style={styles.input}
                placeholder="Enter your mentor ID"
                placeholderTextColor={ABYSS.faint}
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
                placeholderTextColor={ABYSS.faint}
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

            <TouchableOpacity
              onPress={p.onProceed}
              disabled={busy}
              activeOpacity={0.85}
              style={[
                styles.button,
                busy && { opacity: 0.6 },
                web && ({ boxShadow: `0 10px 30px rgba(${ABYSS.blueRgb}, 0.35)` } as any),
              ]}
              testID="abyss-continue"
            >
              {busy ? (
                <View style={styles.row}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.buttonText}>{p.isLoading ? 'Verifying...' : 'Processing...'}</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={rise(foot)}>
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
              <Text style={styles.buttonText}>Dismiss</Text>
            </TouchableOpacity>
            {p.modal.title === 'Email Already Used' && (
              <TouchableOpacity style={[styles.button, { marginTop: 10 }]} onPress={p.onReactivate} activeOpacity={0.85}>
                <Text style={styles.buttonText}>Reactivate Account</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ABYSS.ground },
  flex: { flex: 1 },
  content: {
    flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 28,
    width: '100%', maxWidth: 480, alignSelf: 'center',
  },

  hero: {
    borderRadius: 28, paddingVertical: 28, paddingHorizontal: 24, marginBottom: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center',
  },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '70%' },
  mark: {
    width: 64, height: 64, borderRadius: 18, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  appName: { color: '#FFFFFF', fontSize: 26, fontWeight: '600', letterSpacing: -0.5 },
  tagline: { color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 6 },

  card: {
    backgroundColor: ABYSS.surface, borderRadius: 24, borderWidth: 1, borderColor: ABYSS.edge,
    padding: 20, marginBottom: 20,
  },
  welcome: { color: ABYSS.text, fontSize: 22, fontWeight: '600', marginBottom: 14 },
  label: { color: ABYSS.dim, fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  field: {
    flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 16, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: ABYSS.edge, marginBottom: 12,
  },
  input: { flex: 1, color: ABYSS.text, fontSize: 16, ...(web ? ({ outlineStyle: 'none' } as any) : null) },

  button: {
    height: 56, borderRadius: 18, backgroundColor: ABYSS.blue, marginTop: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  quietButton: {
    height: 52, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },

  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 10 },
  legalLink: { color: '#7FA2FF', fontSize: 12, fontWeight: '600' },
  legalDot: { color: ABYSS.faint, fontSize: 12 },
  footer: { color: ABYSS.faint, fontSize: 11, textAlign: 'center' },

  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 24,
    backgroundColor: 'rgba(5,8,16,0.72)', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    width: '100%', maxWidth: 380, backgroundColor: ABYSS.surface, borderRadius: 24,
    borderWidth: 1, borderColor: ABYSS.edge, padding: 22,
  },
  modalIcon: {
    width: 44, height: 44, borderRadius: 22, alignSelf: 'center', marginBottom: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: `rgba(${ABYSS.blueRgb}, 0.15)`, borderWidth: 1, borderColor: `rgba(${ABYSS.blueRgb}, 0.35)`,
  },
  modalIconText: { color: '#7FA2FF', fontSize: 20, fontWeight: '800' },
  modalTitle: { color: ABYSS.text, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  modalMessage: { color: ABYSS.dim, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 18 },
});
