import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, ScrollView,
  Platform, ActivityIndicator, KeyboardAvoidingView, Animated,
} from 'react-native';
import { Eye, EyeOff, Menu } from 'lucide-react-native';
import { LUX, LuxPill, LuxRule, rise, useEntrance } from '@/components/abyss-lux';

/**
 * The MT5 connect screen in the Abyss style, minimal luxury to match the start
 * page and sign-in (28 Oct 2026): black page, a thin menu mark, the heading set
 * large and thin, fields that are a small spaced label over a fine underline,
 * and one white pill. Presentation only: the MetaTrader screen still owns the
 * connect and disconnect flow and passes values and handlers in.
 */

/** Colours the older Abyss pieces still read; kept so they keep building. */
export const ABYSS = {
  ground: '#0A0E1A',
  surface: '#121826',
  edge: 'rgba(255,255,255,0.08)',
  blue: '#2F6BFF',
  blueRgb: '47, 107, 255',
  text: '#FFFFFF',
  dim: 'rgba(255,255,255,0.55)',
  faint: 'rgba(255,255,255,0.35)',
  green: '#22C55E',
  red: '#F87171',
};

type Props = {
  connected: boolean;
  noBalance: boolean;
  isAuthenticating: boolean;
  authenticationStep: string;
  login: string;
  setLogin: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  server: string;
  onSubmit: () => void;
  onMenu: () => void;
};

const web = Platform.OS === 'web';

export function AbyssConnect(p: Props) {
  const [focus, setFocus] = useState<'login' | 'password' | null>(null);
  const [top, title, rule, form, button] = useEntrance(5, { delay: 110, duration: 750, first: 100 });

  const underline = (name: 'login' | 'password') => [styles.underline, focus === name && { backgroundColor: LUX.white }];

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
          <Animated.View style={[styles.topBar, { opacity: top }]}>
            <TouchableOpacity onPress={p.onMenu} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} testID="abyss-menu">
              <Menu color={LUX.silver} size={22} strokeWidth={1.6} />
            </TouchableOpacity>
            <View testID="connection-status-dot" style={styles.status}>
              <View style={[styles.dot, { backgroundColor: p.connected ? '#22C55E' : 'rgba(255,255,255,0.35)' },
                web && p.connected && ({ boxShadow: '0 0 8px rgba(34,197,94,0.9)' } as any)]} />
              <Text style={[styles.statusText, p.connected && { color: '#22C55E' }]}>
                {p.connected ? 'MT5 CONNECTED' : 'MT5 DISCONNECTED'}
              </Text>
            </View>
          </Animated.View>

          <View style={styles.head}>
            <Animated.Text style={[styles.kicker, rise(title)]}>MT5 ACCOUNT</Animated.Text>
            <Animated.Text style={[styles.title, rise(title, 22)]}>Login Details</Animated.Text>
            <LuxRule progress={rule} />
          </View>

          {p.noBalance && (
            <Text style={styles.noBalance}>This account has no balance. Please fund it to trade.</Text>
          )}

          <Animated.View style={rise(form)}>
            <Text style={styles.label}>LOGIN</Text>
            <TextInput
              style={styles.input}
              placeholder="Login"
              placeholderTextColor={LUX.faint}
              value={p.login}
              onChangeText={p.setLogin}
              keyboardType="numeric"
              editable={!p.connected}
              onFocus={() => setFocus('login')}
              onBlur={() => setFocus(null)}
              testID="abyss-login"
            />
            <View style={underline('login')} />

            <Text style={[styles.label, styles.gap]}>PASSWORD</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
                placeholderTextColor={LUX.faint}
                value={p.password}
                onChangeText={p.setPassword}
                secureTextEntry={!p.showPassword}
                editable={!p.connected}
                onFocus={() => setFocus('password')}
                onBlur={() => setFocus(null)}
                testID="abyss-password"
              />
              <TouchableOpacity
                onPress={() => p.setShowPassword(!p.showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={p.showPassword ? 'Hide password' : 'Show password'}
              >
                {p.showPassword ? <EyeOff color={LUX.white} size={18} strokeWidth={1.6} /> : <Eye color={LUX.grey} size={18} strokeWidth={1.6} />}
              </TouchableOpacity>
            </View>
            <View style={underline('password')} />

            <Text style={[styles.label, styles.gap]}>SERVER</Text>
            <View style={styles.row}>
              <Text style={[styles.input, { flex: 1 }]} numberOfLines={1}>{p.server}</Text>
              <Text style={styles.live}>LIVE</Text>
            </View>
            <View style={styles.underline} />
          </Animated.View>

          {p.isAuthenticating && (
            <View style={styles.authRow}>
              <ActivityIndicator color={LUX.white} size="small" />
              <Text style={styles.authText}>{p.authenticationStep}</Text>
            </View>
          )}

          <Animated.View style={[styles.button, rise(button)]}>
            <LuxPill
              label={p.connected ? 'Disconnect MT5 Account' : 'Link MT5 Account Details'}
              onPress={p.onSubmit}
              busy={p.isAuthenticating}
              busyLabel="Authenticating..."
              variant={p.connected ? 'outline' : 'solid'}
              testID="abyss-submit"
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LUX.black },
  flex: { flex: 1 },
  content: { paddingHorizontal: 28, paddingTop: 22, paddingBottom: 120, width: '100%', maxWidth: 480, alignSelf: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: LUX.grey, fontSize: 10, fontWeight: '500', letterSpacing: 2.4 },

  head: { marginTop: 52, marginBottom: 18 },
  kicker: { color: LUX.grey, fontSize: 11, fontWeight: '500', letterSpacing: 2.4, marginBottom: 10 },
  title: { color: LUX.white, fontSize: 46, lineHeight: 52, fontWeight: '200', letterSpacing: -1.6 },

  noBalance: { color: '#F87171', fontSize: 13, fontWeight: '300', marginBottom: 18 },

  label: { color: LUX.grey, fontSize: 11, fontWeight: '500', letterSpacing: 2.4, marginBottom: 6 },
  gap: { marginTop: 28 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    color: LUX.white, fontSize: 18, fontWeight: '300', paddingVertical: 10,
    ...(web ? ({ outlineStyle: 'none' } as any) : null),
  },
  underline: { height: 1, backgroundColor: LUX.hairline },
  live: { color: '#22C55E', fontSize: 10, fontWeight: '600', letterSpacing: 2.4 },

  authRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  authText: { color: LUX.grey, fontSize: 13, fontWeight: '300' },

  button: { marginTop: 40 },
});
