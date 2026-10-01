import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Linking, ActivityIndicator, Platform, SafeAreaView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react-native';

/**
 * In-app paywall for EA Mobile Connect. Replaces the "Complete Payment" modal
 * that framed the website shop. Pay opens the same secure checkout the shop's
 * Pay button opens (captcha, then Stripe) in an in-app browser tab (Chrome
 * Custom Tab on Android, a new tab on web).
 *
 * Plans, prices and the checkout link format are copied from
 * https://eamobileconnect.com/shop/ (1 Oct 2026), byte for byte, because the
 * payment webhook reads the reference to know the term. If the shop changes,
 * change this too.
 */

const CHECKOUT = 'https://eamobileconnect.com/shop/secure-checkout.php';
const TERMS_URL = 'https://eamobileconnect.com/shop/Ts&Cs.html';
const PLANS = [
  { plan: 30,  ref: 'converter_',     label: '1 Month',  sub: '30 days of access',  price: 'US$39.17',  save: '' },
  { plan: 90,  ref: 'converter_90_',  label: '3 Months', sub: '90 days of access',  price: 'US$69.17',  save: 'Save 41%' },
  { plan: 365, ref: 'converter_365_', label: '1 Year',   sub: '365 days of access', price: 'US$139.18', save: 'Save 70%' },
] as const;
type Plan = (typeof PLANS)[number];
const BENEFITS = ['Mobile VPS Access', 'One Payment, No Automatic Renewal', 'Pay Again Only When You Choose', 'Hands-Free Mobile EA Hosting'];

// Same link the shop builds: lower-cased email, hex of its UTF-8 bytes, term prefix.
function checkoutUrl(email: string, p: Plan): string {
  const e = email.trim().toLowerCase();
  const hex = Array.from(new TextEncoder().encode(e), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${CHECKOUT}?plan=${p.plan}&client_reference_id=${p.ref}${hex}&prefilled_email=${encodeURIComponent(e)}`;
}

interface Props {
  email: string;
  accent: string;
  accentRgb: string;
  notice?: string;
  checking?: boolean;
  onBack: () => void;
  onContinue: () => void; // "I've paid" — re-checks the account
}

export function Paywall({ email, accent, accentRgb, notice, checking, onBack, onContinue }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [opened, setOpened] = useState(false);
  const [plan, setPlan] = useState<Plan>(PLANS[0]);
  const glow = `0 0 12px rgba(${accentRgb}, 0.35), 0 0 24px rgba(${accentRgb}, 0.2), 0 8px 20px rgba(0,0,0,0.5)`;
  const openTerms = () => Linking.openURL(TERMS_URL).catch(() => {});

  const pay = async () => {
    if (!agreed) return;
    const url = checkoutUrl(email, plan);
    try {
      if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
      else await WebBrowser.openBrowserAsync(url, { toolbarColor: '#050505', controlsColor: accent, showTitle: true });
    } catch {
      Linking.openURL(url).catch(() => {});
    }
    setOpened(true);
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <TouchableOpacity onPress={onBack} style={styles.back} activeOpacity={0.7}>
            <ArrowLeft size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.backText}>Back to sign in</Text>
          </TouchableOpacity>

          <Image source={require('../assets/images/icon.png')} style={styles.logo} resizeMode="contain" />

          <Text style={[styles.eyebrow, { color: accent }]}>BUY ACCESS</Text>
          <Text style={styles.title}>Unlock EA Mobile Connect</Text>
          <Text style={styles.sub}>One payment for a fixed period. Nothing renews on its own.</Text>

          <View style={styles.benefits}>
            {BENEFITS.map((b) => (
              <View key={b} style={styles.benefit}>
                <Check size={16} color={accent} />
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.label}>Choose your access period</Text>
          {PLANS.map((p) => {
            const on = p.plan === plan.plan;
            return (
              <TouchableOpacity
                key={p.plan}
                onPress={() => setPlan(p)}
                activeOpacity={0.85}
                style={[styles.plan, { borderColor: on ? accent : 'rgba(255,255,255,0.12)' }, on && ({ boxShadow: glow } as any)]}
                testID={`plan-${p.plan}`}
              >
                <View style={[styles.radio, { borderColor: on ? accent : 'rgba(255,255,255,0.35)' }]}>
                  {on && <View style={[styles.radioDot, { backgroundColor: accent }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.planTop}>
                    <Text style={styles.planLabel}>{p.label}</Text>
                    {p.save ? (
                      <View style={[styles.saveChip, { backgroundColor: `rgba(${accentRgb}, 0.18)` }]}>
                        <Text style={[styles.saveText, { color: accent }]}>{p.save}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.planSub}>{p.sub}</Text>
                </View>
                <Text style={styles.planPrice}>{p.price}</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.agree} onPress={() => setAgreed((v) => !v)} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={[styles.box, agreed && { backgroundColor: accent, borderColor: accent }]}>
              {agreed && <Check size={13} color="#000" />}
            </View>
            <Text style={styles.agreeText}>
              I agree to the{' '}
              <Text style={[styles.link, { color: accent }]} onPress={openTerms}>Terms & Conditions</Text>
              , including the refund policy and trading risk notice.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={pay}
            disabled={!agreed}
            activeOpacity={0.85}
            style={[styles.payBtn, { backgroundColor: agreed ? accent : 'rgba(255,255,255,0.06)', boxShadow: agreed ? `0 10px 36px -8px rgba(${accentRgb}, 0.8)` : 'none' } as any]}
            testID="pay"
          >
            <Text style={[styles.payText, { color: agreed ? '#fff' : 'rgba(255,255,255,0.35)' }]}>Pay {plan.price}</Text>
          </TouchableOpacity>
          <View style={styles.secure}>
            <ShieldCheck size={13} color="rgba(255,255,255,0.45)" />
            <Text style={styles.secureText}>Opens secure Stripe checkout</Text>
          </View>
          <Text style={styles.legal}>
            By continuing you agree to the{' '}
            <Text style={[styles.legalLink, { color: accent }]} onPress={openTerms}>Terms & Conditions</Text>
          </Text>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <TouchableOpacity
            onPress={onContinue}
            disabled={checking}
            activeOpacity={0.8}
            style={[styles.paidBtn, { borderColor: opened ? accent : 'rgba(255,255,255,0.12)' }]}
          >
            {checking ? <ActivityIndicator color={accent} /> : <Text style={[styles.paidText, { color: opened ? accent : 'rgba(255,255,255,0.6)' }]}>I've paid, continue</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505', overflow: 'hidden' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 28 },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center', alignItems: 'center' },
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, marginBottom: 10 },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  logo: { width: 120, height: 80 },
  eyebrow: { marginTop: 14, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  title: { marginTop: 8, fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5, textAlign: 'center' },
  sub: { marginTop: 10, fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: 360 },
  benefits: { alignSelf: 'stretch', marginTop: 22, gap: 12, paddingHorizontal: 4 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { color: '#fff', fontSize: 14 },
  label: { alignSelf: 'flex-start', marginTop: 26, marginBottom: 10, fontSize: 12, fontWeight: '700', letterSpacing: 1, color: 'rgba(255,255,255,0.55)' },
  plan: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 2, borderRadius: 20,
    backgroundColor: 'rgba(12,12,12,0.93)', paddingVertical: 16, paddingHorizontal: 18, marginBottom: 10,
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planLabel: { color: '#fff', fontSize: 16, fontWeight: '800' },
  saveChip: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  saveText: { fontSize: 11, fontWeight: '800' },
  planSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  planPrice: { color: '#fff', fontSize: 18, fontWeight: '900' },
  agree: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 14 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', marginTop: -1 },
  agreeText: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 20 },
  link: { textDecorationLine: 'underline', fontWeight: '600' },
  payBtn: { alignSelf: 'stretch', marginTop: 22, borderRadius: 18, paddingVertical: 17, alignItems: 'center' },
  payText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  secureText: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  legal: { marginTop: 8, color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center' },
  legalLink: { textDecorationLine: 'underline' },
  notice: { marginTop: 18, color: '#fca5a5', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  paidBtn: { alignSelf: 'stretch', marginTop: 18, borderRadius: 18, borderWidth: 1.5, paddingVertical: 15, alignItems: 'center' },
  paidText: { fontSize: 14, fontWeight: '700' },
});
