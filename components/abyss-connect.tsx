import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, ScrollView,
  Platform, ActivityIndicator, Image, KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, Server, Menu, Shield } from 'lucide-react-native';

/**
 * The MT5 connect screen in the Abyss style: deep navy, one soft blue glow,
 * dark glass fields and a single solid blue action. Picked from Conceptzilla's
 * "Abyss" shot on Dribbble (28 Oct 2026). Presentation only: every value and
 * handler comes from the MetaTrader screen, which still owns the connect flow.
 */
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

  const fieldStyle = (name: 'login' | 'password') => [
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
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.menuButton} onPress={p.onMenu} activeOpacity={0.7} testID="abyss-menu">
              <Menu color={ABYSS.dim} size={20} />
            </TouchableOpacity>
            <View
              testID="connection-status-dot"
              style={[styles.statusPill, p.connected ? styles.pillOn : styles.pillOff]}
            >
              <View style={[styles.dot, { backgroundColor: p.connected ? ABYSS.green : ABYSS.faint }]} />
              <Text style={[styles.pillText, { color: p.connected ? ABYSS.green : ABYSS.dim }]}>
                {p.connected ? 'MT5 CONNECTED' : 'MT5 DISCONNECTED'}
              </Text>
            </View>
          </View>

          {p.noBalance && (
            <View style={styles.noBalance}>
              <Text style={styles.noBalanceText}>This account has no balance. Please fund it to trade.</Text>
            </View>
          )}

          {/* The hero: a frosted blue glass panel, the one bright surface on the screen. */}
          <LinearGradient
            colors={['#4C7DFF', '#2448B8', '#141D45']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 1 }}
            style={styles.hero}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.heroSheen}
              pointerEvents="none"
            />
            <View style={styles.heroLogo}>
              <Image source={require('@/assets/images/mt5logo.png')} style={styles.heroLogoImg} resizeMode="contain" />
            </View>
            <Text style={styles.heroKicker}>MT5 ACCOUNT</Text>
            <Text style={styles.heroTitle}>MT5 Login Details</Text>
          </LinearGradient>

          {p.isAuthenticating && (
            <View style={styles.authRow}>
              <ActivityIndicator color={ABYSS.blue} size="small" />
              <Text style={styles.authText}>{p.authenticationStep}</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.label}>Login</Text>
            <View style={fieldStyle('login')}>
              <TextInput
                style={styles.input}
                placeholder="Login"
                placeholderTextColor={ABYSS.faint}
                value={p.login}
                onChangeText={p.setLogin}
                keyboardType="numeric"
                editable={!p.connected}
                onFocus={() => setFocus('login')}
                onBlur={() => setFocus(null)}
                testID="abyss-login"
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={fieldStyle('password')}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={ABYSS.faint}
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
                {p.showPassword ? <EyeOff color={ABYSS.blue} size={18} /> : <Eye color={ABYSS.faint} size={18} />}
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Server</Text>
            <View style={styles.field}>
              <Server color={ABYSS.faint} size={18} style={{ marginRight: 10 }} />
              <Text style={[styles.input, styles.serverText]} numberOfLines={1}>{p.server}</Text>
              <View style={styles.liveTag}>
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={p.onSubmit}
            disabled={p.isAuthenticating}
            activeOpacity={0.85}
            style={[
              styles.button,
              p.connected ? styles.buttonQuiet : styles.buttonSolid,
              p.isAuthenticating && { opacity: 0.6 },
              web && !p.connected && ({ boxShadow: `0 10px 30px rgba(${ABYSS.blueRgb}, 0.35)` } as any),
            ]}
            testID="abyss-submit"
          >
            {p.isAuthenticating ? (
              <View style={styles.buttonRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.buttonText}>AUTHENTICATING...</Text>
              </View>
            ) : (
              <View style={styles.buttonRow}>
                <Shield color={p.connected ? ABYSS.text : '#FFFFFF'} size={16} />
                <Text style={styles.buttonText}>{p.connected ? 'DISCONNECT MT5 ACCOUNT' : 'LINK MT5 ACCOUNT DETAILS'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ABYSS.ground },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120, width: '100%', maxWidth: 480, alignSelf: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  menuButton: {
    width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: ABYSS.surface, borderWidth: 1, borderColor: ABYSS.edge,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
  },
  pillOn: { backgroundColor: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.30)' },
  pillOff: { backgroundColor: ABYSS.surface, borderColor: ABYSS.edge },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  noBalance: {
    backgroundColor: 'rgba(248,113,113,0.10)', borderColor: 'rgba(248,113,113,0.30)', borderWidth: 1,
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 16,
  },
  noBalanceText: { color: ABYSS.red, fontSize: 12, fontWeight: '600', textAlign: 'center' },

  hero: {
    borderRadius: 28, paddingVertical: 28, paddingHorizontal: 24, marginBottom: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  heroSheen: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '70%',
  },
  heroLogo: {
    width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginBottom: 22,
  },
  heroLogoImg: { width: 36, height: 36 },
  heroKicker: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 6 },
  heroTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '600', letterSpacing: -0.5 },

  authRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 },
  authText: { color: ABYSS.dim, fontSize: 13 },

  card: {
    backgroundColor: ABYSS.surface, borderRadius: 24, borderWidth: 1, borderColor: ABYSS.edge,
    padding: 18, marginBottom: 18,
  },
  label: { color: ABYSS.dim, fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  field: {
    flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 16, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: ABYSS.edge, marginBottom: 12,
  },
  input: { flex: 1, color: ABYSS.text, fontSize: 16, ...(web ? ({ outlineStyle: 'none' } as any) : null) },
  serverText: { lineHeight: 52 },
  liveTag: {
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, marginLeft: 8,
    backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)',
  },
  liveText: { color: ABYSS.green, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },

  button: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  buttonSolid: { backgroundColor: ABYSS.blue },
  buttonQuiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 1.2 },
});
