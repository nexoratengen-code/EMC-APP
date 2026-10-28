import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Linking, Platform, Animated } from 'react-native';
import { Menu, Check, ChevronRight } from 'lucide-react-native';
import { LUX, LuxRule, rise, useEntrance, FocusFade } from '@/components/abyss-lux';
import type { GlassMode } from '@/providers/theme-provider';

/**
 * Settings in the Abyss style (28 Oct 2026). Abyss sets its own colours and
 * font, so only what applies is shown: which style the app uses (so anyone
 * can go back to another), and the About links. The other styles keep the
 * full settings screen with themes, fonts and card options.
 */
const STYLES: { mode: GlassMode; label: string; sub: string }[] = [
  { mode: 'abyss', label: 'Abyss', sub: 'Black, white and light' },
  { mode: 'commander', label: 'Commander', sub: 'Commander with robot background' },
  { mode: 'neon', label: 'Neon', sub: 'Neon glow with spinning borders' },
  { mode: 'minimal', label: 'Minimal', sub: 'Dark glass with accent aura' },
  { mode: 'liquid', label: 'Liquid', sub: 'Frosted translucent iOS glass' },
  { mode: 'mech', label: 'Mech', sub: 'Robot background with voice circle' },
];

const LINKS = [
  { title: 'Terms & Conditions', sub: 'The rules for using EA Mobile Connect', url: 'https://eamobileconnect.com/admin/info/about/terms.php' },
  { title: 'Privacy Policy', sub: 'How your information is handled', url: 'https://eamobileconnect.com/admin/info/about/privacy.php' },
];

export function AbyssSettings({ glassMode, setGlassMode, onMenu }: {
  glassMode: GlassMode; setGlassMode: (m: GlassMode) => void; onMenu: () => void;
}) {
  const [top, title, rule, body] = useEntrance(4, { delay: 110, duration: 750, first: 100 });

  return (
    <FocusFade>
    <SafeAreaView
      style={[
        styles.container,
        Platform.OS === 'web' && ({
          backgroundImage: 'radial-gradient(ellipse 70% 45% at 85% 0%, rgba(255,255,255,0.07) 0%, transparent 70%)',
        } as any),
      ]}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: top }}>
          <TouchableOpacity onPress={onMenu} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ alignSelf: 'flex-start' }}>
            <Menu color={LUX.silver} size={22} strokeWidth={1.6} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.Text style={[styles.title, rise(title, 22)]}>Settings</Animated.Text>
        <LuxRule progress={rule} />

        <Animated.View style={rise(body)}>
          <Text style={styles.label}>STYLE</Text>
          <View style={styles.list}>
            {STYLES.map((s) => {
              const on = s.mode === glassMode;
              return (
                <TouchableOpacity key={s.mode} style={styles.row} onPress={() => setGlassMode(s.mode)} activeOpacity={0.6} testID={`style-${s.mode}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, !on && { color: 'rgba(255,255,255,0.6)' }]}>{s.label}</Text>
                    <Text style={styles.rowSub}>{s.sub}</Text>
                  </View>
                  {on && <Check color={LUX.white} size={20} strokeWidth={2.2} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 40 }]}>ABOUT</Text>
          <View style={styles.list}>
            {LINKS.map((l) => (
              <TouchableOpacity key={l.url} style={styles.row} onPress={() => Linking.openURL(l.url).catch(() => {})} activeOpacity={0.6}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{l.title}</Text>
                  <Text style={styles.rowSub}>{l.sub}</Text>
                </View>
                <ChevronRight color={LUX.faint} size={18} strokeWidth={1.4} />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <Text style={styles.powered}>Powered by EA Mobile Connect</Text>
      </ScrollView>
    </SafeAreaView>
    </FocusFade>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LUX.black },
  content: { paddingHorizontal: 28, paddingTop: 22, paddingBottom: 60, width: '100%', maxWidth: 480, alignSelf: 'center' },
  title: { color: LUX.white, fontSize: 46, lineHeight: 52, fontWeight: '200', letterSpacing: -1.6, marginTop: 52 },
  label: { color: LUX.grey, fontSize: 11, fontWeight: '500', letterSpacing: 2.4, marginBottom: 6 },
  list: { borderTopWidth: 1, borderTopColor: LUX.hairline },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: LUX.hairline },
  rowTitle: { color: LUX.white, fontSize: 17, fontWeight: '300' },
  rowSub: { color: LUX.grey, fontSize: 13, fontWeight: '300', marginTop: 3 },
  powered: { color: LUX.faint, fontSize: 11, textAlign: 'center', marginTop: 40, letterSpacing: 0.4 },
});
