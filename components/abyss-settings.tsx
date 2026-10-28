import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Linking, Platform, Animated } from 'react-native';
import { Menu, Check, ChevronRight } from 'lucide-react-native';
import { LUX, LuxRule, rise, useEntrance, FocusFade, GLOW_COLOURS } from '@/components/abyss-lux';
import { useTheme, type GlassMode, type PictureAlign } from '@/providers/theme-provider';

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

export function AbyssSettings({ glassMode, setGlassMode, glowColor, setGlowColor, onMenu }: {
  glassMode: GlassMode; setGlassMode: (m: GlassMode) => void;
  glowColor: string; setGlowColor: (c: string) => void; onMenu: () => void;
}) {
  const [top, title, rule, body] = useEntrance(4, { delay: 110, duration: 750, first: 100 });
  const { pictureAlign, setPictureAlign, pictureBackground, setPictureBackground } = useTheme();

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
          {/* Glow: every glow in this style (cards, panel, menu, halo) follows it.
              Green for running and red for remove keep their meaning. */}
          <Text style={styles.label}>GLOW</Text>
          <View style={styles.swatches}>
            {GLOW_COLOURS.map((c) => {
              const on = c.toLowerCase() === (glowColor || '').toLowerCase();
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setGlowColor(c)}
                  activeOpacity={0.75}
                  accessibilityLabel={`Glow ${c}`}
                  testID={`glow-${c.slice(1)}`}
                  style={[styles.swatchRing, on && { borderColor: c }, on && Platform.OS === 'web' && ({ boxShadow: `0 0 14px ${c}99` } as any)]}
                >
                  <View style={[styles.swatch, { backgroundColor: c }]} />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Where the home puts the EA picture at the top. */}
          <Text style={[styles.label, { marginTop: 36 }]}>PICTURE</Text>
          <View style={styles.segment}>
            {(['left', 'center', 'right'] as PictureAlign[]).map((a) => {
              const on = a === pictureAlign;
              return (
                <TouchableOpacity
                  key={a}
                  onPress={() => setPictureAlign(a)}
                  activeOpacity={0.75}
                  style={[styles.segmentItem, on && styles.segmentOn]}
                  testID={`picture-${a}`}
                >
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                    {a === 'left' ? 'Left' : a === 'center' ? 'Centre' : 'Right'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Small toggle: the picture as a soft background behind the home. */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setPictureBackground(!pictureBackground)}
            activeOpacity={0.75}
            testID="picture-background"
            accessibilityRole="switch"
            accessibilityState={{ checked: pictureBackground }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Picture as background</Text>
              <Text style={styles.rowSub}>Fills the top of the home, softly</Text>
            </View>
            <View style={[styles.track, pictureBackground && styles.trackOn]}>
              <View style={[styles.thumb, pictureBackground && styles.thumbOn]} />
            </View>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 40 }]}>STYLE</Text>
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
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 10 },
  segment: {
    flexDirection: 'row', padding: 4, marginTop: 6, borderRadius: 26,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: '#0A0A0B',
  },
  segmentItem: { flex: 1, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: LUX.white },
  segmentText: { color: LUX.silver, fontSize: 14, fontWeight: '400' },
  segmentTextOn: { color: '#000000', fontWeight: '500' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, marginTop: 10, borderBottomWidth: 1, borderBottomColor: LUX.hairline },
  track: {
    width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  trackOn: { backgroundColor: LUX.white, borderColor: LUX.white },
  thumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.7)' },
  thumbOn: { backgroundColor: '#000000', transform: [{ translateX: 18 }] },
  swatchRing: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: LUX.hairline },
  rowTitle: { color: LUX.white, fontSize: 17, fontWeight: '300' },
  rowSub: { color: LUX.grey, fontSize: 13, fontWeight: '300', marginTop: 3 },
  powered: { color: LUX.faint, fontSize: 11, textAlign: 'center', marginTop: 40, letterSpacing: 0.4 },
});
