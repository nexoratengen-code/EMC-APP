import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Linking,
  Platform, KeyboardAvoidingView, ScrollView, Animated, Image, Easing, AccessibilityInfo,
} from 'react-native';
import { LUX, LuxMark, LuxPill, LuxRule, rise, useEntrance } from '@/components/abyss-lux';

/**
 * Sign in, minimal luxury, matching the start page: black page, the silver
 * mark, EMC's glowing robot (dev's ask), "Welcome Back" huge and thin, a hairline, and fields that are only a
 * small label over a fine underline that turns white when in use. White pill.
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
  /** "Access expired? Reactivate your account" under the form (Phase 1, as on TradePort). */
  onReactivateLink: () => void;
};

export function AbyssLogin(p: Props) {
  const [focus, setFocus] = useState<'mentor' | 'email' | null>(null);
  const [mark, art, title, rule, tagline, form, foot] = useEntrance(7, { delay: 120, duration: 800, first: 150 });
  const float = useRef(new Animated.Value(0)).current;

  // The robot hovers, as on the start page.
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

  const underline = (name: 'mentor' | 'email') => [
    styles.underline,
    focus === name && { backgroundColor: LUX.white },
  ];

  return (
    <SafeAreaView
      style={[
        styles.container,
        web && ({
          backgroundImage: 'radial-gradient(ellipse 70% 45% at 85% 0%, rgba(255,255,255,0.07) 0%, transparent 70%)',
        } as any),
      ]}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: mark }}>
            <LuxMark />
          </Animated.View>

          <Animated.View
            style={[
              styles.artWrap,
              {
                opacity: art,
                transform: [
                  { scale: art.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                  { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Image source={require('@/assets/images/emc-robot-glow.png')} style={styles.art} resizeMode="contain" />
          </Animated.View>

          <View style={styles.headBlock}>
            <Animated.Text style={[styles.title, rise(title, 22)]}>Welcome Back</Animated.Text>
            <LuxRule progress={rule} />
            <Animated.Text style={[styles.tagline, rise(tagline)]}>Algorithmic Trading Platform</Animated.Text>
          </View>

          <Animated.View style={rise(form)}>
            <Text style={styles.label}>MENTOR ID</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your mentor ID"
              placeholderTextColor={LUX.faint}
              value={p.mentorId}
              onChangeText={p.setMentorId}
              autoCapitalize="none"
              onFocus={() => setFocus('mentor')}
              onBlur={() => setFocus(null)}
              testID="abyss-mentor"
            />
            <View style={underline('mentor')} />

            <Text style={[styles.label, { marginTop: 28 }]}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={LUX.faint}
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
            <View style={underline('email')} />

            <View style={styles.button}>
              <LuxPill
                label="Continue"
                onPress={p.onProceed}
                busy={p.isLoading || p.isPaymentProcessing}
                busyLabel={p.isLoading ? 'Verifying...' : 'Processing...'}
                testID="abyss-continue"
              />
            </View>
          </Animated.View>

          <Animated.View style={[styles.reactivateRow, { opacity: foot }]}>
            <Text style={styles.reactivateText}>Access expired?</Text>
            <TouchableOpacity onPress={p.onReactivateLink} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} testID="reactivate-link">
              <Text style={styles.reactivateLink}>Reactivate your account</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.foot, { opacity: foot }]}>
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
            <Text style={styles.modalTitle}>{p.modal.title}</Text>
            <View style={styles.modalRule} />
            <Text style={styles.modalMessage}>{p.modal.message}</Text>
            {p.modal.title === 'Email Already Used' && (
              <View style={{ marginBottom: 10 }}>
                <LuxPill label="Reactivate Account" onPress={p.onReactivate} />
              </View>
            )}
            <TouchableOpacity style={styles.quietButton} onPress={p.onDismissModal} activeOpacity={0.8}>
              <Text style={styles.quietText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LUX.black },
  flex: { flex: 1 },
  content: {
    flexGrow: 1, paddingHorizontal: 28, paddingTop: 28, paddingBottom: 28,
    width: '100%', maxWidth: 480, alignSelf: 'center',
  },

  artWrap: { height: 190, marginHorizontal: -28, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  art: { width: '100%', height: '100%', transform: [{ scale: 1.2 }] },
  headBlock: { marginTop: 6, marginBottom: 36 },
  title: { color: LUX.white, fontSize: 46, lineHeight: 52, fontWeight: '200', letterSpacing: -1.6 },
  tagline: { color: LUX.grey, fontSize: 15, fontWeight: '300' },

  label: { color: LUX.grey, fontSize: 11, fontWeight: '500', letterSpacing: 2.4, marginBottom: 6 },
  input: {
    color: LUX.white, fontSize: 18, fontWeight: '300', paddingVertical: 10,
    ...(web ? ({ outlineStyle: 'none' } as any) : null),
  },
  underline: { height: 1, backgroundColor: LUX.hairline },

  button: { marginTop: 44 },

  reactivateRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 22 },
  reactivateText: { color: LUX.grey, fontSize: 13, fontWeight: '300' },
  reactivateLink: { color: LUX.white, fontSize: 13, fontWeight: '500', textDecorationLine: 'underline' },
  foot: { marginTop: 'auto', paddingTop: 36 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 8 },
  legalLink: { color: LUX.grey, fontSize: 12, fontWeight: '400' },
  legalDot: { color: LUX.faint, fontSize: 12 },
  footer: { color: LUX.faint, fontSize: 11, textAlign: 'center', letterSpacing: 0.4 },

  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 28,
    backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    width: '100%', maxWidth: 380, backgroundColor: '#0A0A0B', borderRadius: 26,
    borderWidth: 1, borderColor: LUX.hairline, padding: 26,
  },
  modalTitle: { color: LUX.white, fontSize: 24, fontWeight: '300', letterSpacing: -0.5 },
  modalRule: { width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.4)', marginVertical: 14 },
  modalMessage: { color: LUX.grey, fontSize: 15, lineHeight: 22, fontWeight: '300', marginBottom: 24 },
  quietButton: {
    height: 54, borderRadius: 27, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  quietText: { color: LUX.white, fontSize: 15, fontWeight: '400' },
});
