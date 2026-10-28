import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Image } from 'react-native';
import { X, ChevronRight } from 'lucide-react-native';
import { LUX, LuxMark, useGlowRgb } from '@/components/abyss-lux';

/**
 * The side menu in the Abyss style, matching the home (28 Oct 2026): the EA
 * as a card with its picture and live status, then every page as a dark,
 * fully rounded pill with a round icon. The page you are on glows in the
 * member's chosen glow colour (Settings > Glow; EMC cyan by default). The sidebar's slide and overlay are reused;
 * only what is inside changes.
 */
type IconType = React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
export type MenuItem = { key: string; label: string; sub?: string; route: string; icon: IconType };

type Props = {
  items: MenuItem[];
  activeKey: string | null;
  eaName: string | null;
  eaImage: string | null;
  running: boolean;
  onNav: (route: string) => void;
  onClose: () => void;
};

const web = Platform.OS === 'web';

const glow = (rgb: string, strength = 1) => ({
  borderColor: `rgba(${rgb}, ${0.5 * strength})`,
  ...(web ? ({ boxShadow: `0 0 18px rgba(${rgb}, ${0.25 * strength}), 0 0 40px rgba(${rgb}, ${0.1 * strength}), inset 0 1px 0 rgba(255,255,255,0.06)` } as any) : {
    shadowColor: `rgb(${rgb})`, shadowOpacity: 0.35 * strength, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  }),
});

export function AbyssMenu({ items, activeKey, eaName, eaImage, running, onNav, onClose }: Props) {
  const BLUE = useGlowRgb();
  return (
    <View style={[styles.panel, web && ({ backgroundImage: `radial-gradient(ellipse 90% 35% at 0% 0%, rgba(${BLUE}, 0.10) 0%, transparent 70%)` } as any)]}>
      <View style={styles.header}>
        <LuxMark />
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.6} style={styles.close}>
          <X color={LUX.silver} size={18} strokeWidth={1.6} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {eaName && (
          <View style={[styles.eaCard, running ? glow('34, 197, 94', 0.8) : glow(BLUE, 0.55)]}>
            <View style={styles.avatar}>
              {eaImage ? (
                <Image source={{ uri: eaImage }} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <Image source={require('@/assets/images/emc-robot-glow.png')} style={[styles.avatarImg, { transform: [{ scale: 1.45 }] }]} resizeMode="contain" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eaName} numberOfLines={1}>{eaName}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: running ? '#22C55E' : 'rgba(255,255,255,0.35)' },
                  web && running && ({ boxShadow: '0 0 8px rgba(34,197,94,0.9)' } as any)]} />
                <Text style={[styles.status, running && { color: '#22C55E' }]}>{running ? 'RUNNING' : 'IDLE'}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.section}>MENU</Text>
        <View style={styles.list}>
          {items.map((item) => {
            const active = item.key === activeKey;
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => onNav(item.route)}
                activeOpacity={0.7}
                style={[styles.pill, active && glow(BLUE)]}
                testID={`menu-${item.key.replace(/\W/g, '') || 'home'}`}
              >
                <View style={[styles.icon, active && { borderColor: `rgba(${BLUE}, 0.55)`, backgroundColor: `rgba(${BLUE}, 0.12)` }]}>
                  <Icon color={active ? LUX.white : LUX.silver} size={17} strokeWidth={1.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
                  {!!item.sub && <Text style={styles.sub}>{item.sub}</Text>}
                </View>
                {active
                  ? <View style={[styles.activeDot, { backgroundColor: `rgb(${BLUE})` }, web && ({ boxShadow: `0 0 10px rgba(${BLUE}, 0.9)` } as any)]} />
                  : <ChevronRight color={LUX.faint} size={16} strokeWidth={1.4} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Text style={styles.footer}>Powered by EA Mobile Connect</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    ...StyleSheet.absoluteFillObject, backgroundColor: LUX.black,
    borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.10)', paddingTop: 22,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  close: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  scroll: { paddingHorizontal: 16, paddingTop: 26, paddingBottom: 24 },

  eaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 36, paddingVertical: 12, paddingLeft: 12, paddingRight: 18,
    backgroundColor: '#0A0A0B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: '#000',
  },
  avatarImg: { width: '100%', height: '100%' },
  eaName: { color: LUX.white, fontSize: 18, fontWeight: '300', letterSpacing: -0.3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  status: { color: LUX.grey, fontSize: 10, fontWeight: '500', letterSpacing: 2.4 },

  section: { color: LUX.grey, fontSize: 10, fontWeight: '500', letterSpacing: 2.6, marginTop: 28, marginBottom: 12, marginLeft: 6 },
  list: { gap: 10 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 60, borderRadius: 30, paddingLeft: 9, paddingRight: 18, paddingVertical: 8,
    backgroundColor: '#0A0A0B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  icon: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  label: { color: 'rgba(255,255,255,0.72)', fontSize: 16, fontWeight: '300' },
  labelActive: { color: LUX.white, fontWeight: '400' },
  sub: { color: LUX.faint, fontSize: 11, fontWeight: '300', marginTop: 2 },
  activeDot: { width: 7, height: 7, borderRadius: 4 },

  footer: { color: LUX.faint, fontSize: 11, paddingHorizontal: 22, paddingBottom: 22, letterSpacing: 0.4 },
});
