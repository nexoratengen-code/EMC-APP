import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { LUX, LuxMark } from '@/components/abyss-lux';

/**
 * The side menu in the Abyss style (28 Oct 2026): a black panel with a
 * hairline edge, the silver mark, the EA and its status, and the pages as
 * large thin words; the current page is white, the rest grey. The sidebar's
 * own slide and overlay are reused; only what is inside changes. The glow
 * colour and hide-hero switches belong to the other styles and are not shown.
 */
export type MenuItem = { key: string; label: string; sub?: string; route: string };

type Props = {
  items: MenuItem[];
  activeKey: string | null;
  eaName: string | null;
  running: boolean;
  onNav: (route: string) => void;
  onClose: () => void;
};

export function AbyssMenu({ items, activeKey, eaName, running, onNav, onClose }: Props) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <LuxMark />
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.6}>
          <X color={LUX.silver} size={20} strokeWidth={1.6} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {eaName && (
          <View style={styles.ea}>
            <Text style={styles.eaName} numberOfLines={1}>{eaName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: running ? '#22C55E' : 'rgba(255,255,255,0.35)' },
                Platform.OS === 'web' && running && ({ boxShadow: '0 0 8px rgba(34,197,94,0.9)' } as any)]} />
              <Text style={[styles.status, running && { color: '#22C55E' }]}>{running ? 'RUNNING' : 'IDLE'}</Text>
            </View>
          </View>
        )}

        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <TouchableOpacity key={item.key} onPress={() => onNav(item.route)} activeOpacity={0.6} style={styles.item}>
              <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
              {!!item.sub && <Text style={styles.sub}>{item.sub}</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.footer}>Powered by EA Mobile Connect</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    ...StyleSheet.absoluteFillObject, backgroundColor: LUX.black,
    borderRightWidth: 1, borderRightColor: LUX.hairline, paddingTop: 22,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26 },
  scroll: { paddingHorizontal: 26, paddingTop: 36, paddingBottom: 30 },

  ea: { paddingBottom: 22, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: LUX.hairline },
  eaName: { color: LUX.white, fontSize: 22, fontWeight: '300', letterSpacing: -0.4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  status: { color: LUX.grey, fontSize: 10, fontWeight: '500', letterSpacing: 2.4 },

  item: { paddingVertical: 12 },
  label: { color: 'rgba(255,255,255,0.45)', fontSize: 26, fontWeight: '200', letterSpacing: -0.6 },
  labelActive: { color: LUX.white },
  sub: { color: LUX.faint, fontSize: 12, fontWeight: '300', marginTop: 2 },

  footer: { color: LUX.faint, fontSize: 11, paddingHorizontal: 26, paddingBottom: 26, letterSpacing: 0.4 },
});
