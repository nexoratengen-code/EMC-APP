import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image, Platform, Animated, Easing,
  AccessibilityInfo, Modal,
} from 'react-native';
import { Menu, ChevronRight, CalendarDays, TrendingUp, Play, Square, BarChart3, Plus, Trash2, Repeat } from 'lucide-react-native';
import { LUX, LuxPill, LuxRule, rise, useEntrance, FocusFade, useGlowRgb } from '@/components/abyss-lux';

/**
 * Home in the Abyss style, minimal luxury (28 Oct 2026). The same things as
 * the TradePort-level home (Phase 3), set the way the start page is: black
 * page, the EA's picture with a soft halo, its name large and thin, whether
 * its robot is RUNNING on the server or IDLE, one white pill to Trade or Stop,
 * News and Scan as quiet pills, and the rest as a list with hairlines.
 *
 * Presentation only: app/(tabs)/index.tsx owns every action and passes it in.
 */
const web = Platform.OS === 'web';
const native = !web;

// Soft glow round the trade panel and the cards, in the member's chosen glow
// colour (Settings > Glow; EMC cyan by default). Set GLOW to false for plain edges.
const GLOW = true;
const glow = (rgb: string, strength = 1) => (GLOW ? {
  borderColor: `rgba(${rgb}, ${0.42 * strength})`,
  ...(web ? ({ boxShadow: `0 0 18px rgba(${rgb}, ${0.22 * strength}), 0 0 42px rgba(${rgb}, ${0.10 * strength}), inset 0 1px 0 rgba(255,255,255,0.06)` } as any) : {
    shadowColor: `rgb(${rgb})`, shadowOpacity: 0.35 * strength, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  }),
} : {});
const SOFT_RED = '248, 113, 113';

type OtherEA = { id: string; name: string; image: string | null };

type Props = {
  name: string;
  description: string;
  image: string | null;
  running: boolean;
  runningDetail: string | null;
  botActive: boolean;
  otherEAs: OtherEA[];
  onMenu: () => void;
  onTrade: () => void;
  onNews: () => void;
  onScan: () => void;
  onQuotes: () => void;
  onRemove: () => void;
  onAddEA: () => void;
  onSwitchEA: (id: string) => void;
  removeAsk: boolean;
  onRemoveConfirm: () => void;
  onRemoveCancel: () => void;
  setupMsg: string | null;
  onSetupConnect: () => void;
  onSetupCancel: () => void;
};

/** A pill card in the same shape as the trade panel: icon, words, arrow. */
function Row({ title, sub, onPress, testID, danger, Icon }: {
  title: string; sub?: string; onPress: () => void; testID?: string; danger?: boolean;
  Icon: React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
}) {
  const tint = danger ? '#F87171' : LUX.white;
  const accent = useGlowRgb();
  return (
    <TouchableOpacity style={[styles.card, danger && styles.cardDanger, glow(danger ? SOFT_RED : accent, danger ? 0.7 : 0.8)]} onPress={onPress} activeOpacity={0.7} testID={testID}>
      <View style={[styles.cardIcon, danger && { borderColor: 'rgba(248,113,113,0.35)' }]}>
        <Icon color={tint} size={18} strokeWidth={1.6} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: '#F87171' }]}>{title}</Text>
        {!!sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      <ChevronRight color={danger ? '#F87171' : LUX.faint} size={18} strokeWidth={1.4} />
    </TouchableOpacity>
  );
}

/** A quiet confirm sheet in the same style, for Remove and Setup required. */
function LuxDialog({ visible, title, message, primary, onPrimary, secondary, onSecondary, testID }: {
  visible: boolean; title: string; message: string; primary: string; onPrimary: () => void;
  secondary: string; onSecondary: () => void; testID?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSecondary}>
      <View style={styles.overlay}>
        <View style={styles.dialog} testID={testID}>
          <Text style={styles.dialogTitle}>{title}</Text>
          <View style={styles.dialogRule} />
          <Text style={styles.dialogMessage}>{message}</Text>
          <LuxPill label={primary} onPress={onPrimary} />
          <TouchableOpacity onPress={onSecondary} activeOpacity={0.7} style={styles.dialogSecondary}>
            <Text style={styles.dialogSecondaryText}>{secondary}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function AbyssHome(p: Props) {
  const [top, art, title, rule, actions, list] = useEntrance(6, { delay: 110, duration: 750, first: 100 });
  const halo = useRef(new Animated.Value(0)).current;
  const accent = useGlowRgb();

  // The halo round the picture breathes slowly while the robot is running.
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    if (!p.running) { halo.setValue(0); return; }
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(halo, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(halo, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]));
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); };
  }, [p.running, halo]);

  return (
    <FocusFade>
    <SafeAreaView
      style={[
        styles.container,
        web && ({
          backgroundImage: 'radial-gradient(ellipse 70% 45% at 85% 0%, rgba(255,255,255,0.07) 0%, transparent 70%)',
        } as any),
      ]}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.topBar, { opacity: top }]}>
          <TouchableOpacity onPress={p.onMenu} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} testID="abyss-menu">
            <Menu color={LUX.silver} size={22} strokeWidth={1.6} />
          </TouchableOpacity>
          <View style={styles.status} testID="ea-status">
            <View style={[styles.dot, { backgroundColor: p.running ? '#22C55E' : 'rgba(255,255,255,0.35)' },
              web && p.running && ({ boxShadow: '0 0 8px rgba(34,197,94,0.9)' } as any)]} />
            <Text style={[styles.statusText, p.running && { color: '#22C55E' }]}>{p.running ? 'RUNNING' : 'IDLE'}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.artRow, { opacity: art }]}>
          <View style={styles.portrait}>
            <Animated.View
              pointerEvents="none"
              style={[styles.halo, {
                opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [p.running ? 0.35 : 0.18, 0.7] }),
                transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
              }, web && ({ filter: 'blur(14px)' } as any), { backgroundColor: p.running ? 'rgba(34,197,94,0.55)' : `rgba(${accent}, 0.55)` }]}
            />
            <View style={styles.frame}>
              {p.image ? (
                <Image source={{ uri: p.image }} style={styles.portraitImg} resizeMode="cover" />
              ) : (
                <Image source={require('@/assets/images/emc-robot-glow.png')} style={[styles.portraitImg, { transform: [{ scale: 1.45 }] }]} resizeMode="contain" />
              )}
            </View>
          </View>
        </Animated.View>

        <Animated.Text testID="ea-title" style={[styles.title, rise(title, 22)]} numberOfLines={2}>{p.name}</Animated.Text>
        <Animated.Text style={[styles.subtitle, rise(title)]}>
          {p.running && p.runningDetail ? p.runningDetail : p.description}
        </Animated.Text>
        <LuxRule progress={rule} />

        {/* One panel like TradePort's: News left, Trade in the centre, Scan right. */}
        <Animated.View style={[styles.panel, glow(accent), rise(actions)]}>
          <TouchableOpacity style={styles.side} onPress={p.onNews} activeOpacity={0.6} testID="action-fundamentals">
            <CalendarDays color={LUX.white} size={18} strokeWidth={1.6} />
            <Text style={styles.sideLabel}>NEWS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.centre} onPress={p.onTrade} activeOpacity={0.8} testID="action-start">
            <View
              style={[
                styles.tradeRing,
                p.botActive && { borderColor: 'rgba(34,197,94,0.6)' },
                web && ({ boxShadow: p.botActive ? '0 0 22px rgba(34,197,94,0.35)' : '0 0 26px rgba(255,255,255,0.18)' } as any),
              ]}
            >
              <View style={[styles.tradeCore, p.botActive && styles.tradeCoreActive]}>
                {p.botActive
                  ? <Square color={LUX.white} size={18} fill={LUX.white} />
                  : <Play color="#000000" size={22} fill="#000000" style={{ marginLeft: 3 }} />}
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.side, styles.sideRight]} onPress={p.onScan} activeOpacity={0.6} testID="action-scan">
            <Text style={styles.sideLabel}>SCAN</Text>
            <TrendingUp color={LUX.white} size={18} strokeWidth={1.6} />
          </TouchableOpacity>
        </Animated.View>
        <Animated.Text style={[styles.tradeLabel, { opacity: actions }, p.botActive && { color: '#22C55E' }]}>
          {p.botActive ? 'STOP' : 'TRADE'}
        </Animated.Text>

        <Animated.View style={[styles.list, { opacity: list }]}>
          {/* The EA card, as in the side menu (and where TradePort shows its EA):
              picture, name and live status; green glow while the robot runs. */}
          <View testID="ea-info-card" style={[styles.eaCard, p.running ? glow('34, 197, 94', 0.8) : glow(accent, 0.55)]}>
            <View style={styles.eaAvatar}>
              {p.image ? (
                <Image source={{ uri: p.image }} style={styles.portraitImg} resizeMode="cover" />
              ) : (
                <Image source={require('@/assets/images/emc-robot-glow.png')} style={[styles.portraitImg, { transform: [{ scale: 1.45 }] }]} resizeMode="contain" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eaCardName} numberOfLines={1}>{p.name}</Text>
              <View style={styles.eaCardStatusRow}>
                <View style={[styles.dot, { backgroundColor: p.running ? '#22C55E' : 'rgba(255,255,255,0.35)' },
                  web && p.running && ({ boxShadow: '0 0 8px rgba(34,197,94,0.9)' } as any)]} />
                <Text style={[styles.statusText, p.running && { color: '#22C55E' }]} numberOfLines={1}>
                  {p.running ? (p.runningDetail ? `RUNNING · ${p.runningDetail}` : 'RUNNING') : 'IDLE'}
                </Text>
              </View>
            </View>
          </View>

          {p.otherEAs.length > 0 && (
            <>
              <Text style={styles.listLabel}>YOUR EAS</Text>
              {p.otherEAs.map((ea) => (
                <Row key={ea.id} Icon={Repeat} title={ea.name} sub="Tap to make it the active EA" onPress={() => p.onSwitchEA(ea.id)} />
              ))}
              <View style={{ height: 18 }} />
            </>
          )}
          <Row Icon={BarChart3} title="Chart Scanner" sub="AI-powered trade analysis" onPress={p.onScan} testID="chart-scanner-card" />
          <Row Icon={TrendingUp} title="Quotes" sub="Live prices on your account" onPress={p.onQuotes} testID="action-quotes" />
          <Row Icon={Plus} title="Add a New EA" sub="Have a valid license key" onPress={p.onAddEA} testID="add-ea-card" />
          <Row Icon={Trash2} title="Remove EA" onPress={p.onRemove} testID="action-remove" danger />
        </Animated.View>

        <Text style={styles.powered}>Powered by EA Mobile Connect</Text>
      </ScrollView>

      <LuxDialog
        visible={p.removeAsk}
        title="Remove EA"
        message={`Are you sure you want to remove ${p.name}? This action cannot be undone.`}
        primary="Remove"
        onPrimary={p.onRemoveConfirm}
        secondary="Cancel"
        onSecondary={p.onRemoveCancel}
        testID="remove-dialog"
      />
      <LuxDialog
        visible={!!p.setupMsg}
        title="Setup Required"
        message={p.setupMsg || ''}
        primary="Connect Account"
        onPrimary={p.onSetupConnect}
        secondary="Cancel"
        onSecondary={p.onSetupCancel}
        testID="setup-dialog"
      />
    </SafeAreaView>
    </FocusFade>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LUX.black },
  content: { paddingHorizontal: 28, paddingTop: 22, paddingBottom: 60, width: '100%', maxWidth: 480, alignSelf: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: LUX.grey, fontSize: 10, fontWeight: '500', letterSpacing: 2.4 },

  artRow: { marginTop: 36, marginBottom: 26 },
  portrait: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 104, height: 104, borderRadius: 52, backgroundColor: 'rgba(120,170,255,0.55)' },
  // The circle is fixed and clips; only the picture inside may be scaled.
  frame: {
    width: 104, height: 104, borderRadius: 52, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: '#000',
  },
  portraitImg: { width: '100%', height: '100%' },

  title: { color: LUX.white, fontSize: 44, lineHeight: 50, fontWeight: '200', letterSpacing: -1.5 },
  subtitle: { color: LUX.grey, fontSize: 15, fontWeight: '300', marginTop: 8 },

  // The same long pill shape as the white button, holding all three.
  panel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 92, borderRadius: 46, paddingHorizontal: 7,
    backgroundColor: '#0A0A0B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  side: { flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  sideRight: {},
  sideLabel: { color: LUX.silver, fontSize: 12, fontWeight: '500', letterSpacing: 2.4 },
  centre: { alignItems: 'center', justifyContent: 'center' },
  tradeRing: {
    width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  tradeCore: { width: 62, height: 62, borderRadius: 31, backgroundColor: LUX.white, alignItems: 'center', justifyContent: 'center' },
  tradeCoreActive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(34,197,94,0.6)' },
  tradeLabel: { color: LUX.white, fontSize: 11, fontWeight: '600', letterSpacing: 2.4, textAlign: 'center', marginTop: 12 },

  list: { marginTop: 36, gap: 12 },
  listLabel: { color: LUX.grey, fontSize: 11, fontWeight: '500', letterSpacing: 2.4, marginTop: 18, marginBottom: 4 },
  // Same family as the trade panel: dark, fine edge, fully rounded.
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    minHeight: 76, borderRadius: 38, paddingLeft: 14, paddingRight: 22, paddingVertical: 12,
    backgroundColor: '#0A0A0B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  cardDanger: { borderColor: 'rgba(248,113,113,0.28)' },
  eaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 38, paddingVertical: 12, paddingLeft: 12, paddingRight: 20,
    backgroundColor: '#0A0A0B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  eaAvatar: {
    width: 52, height: 52, borderRadius: 26, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: '#000',
  },
  eaCardName: { color: LUX.white, fontSize: 18, fontWeight: '300', letterSpacing: -0.3 },
  eaCardStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cardIcon: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  rowTitle: { color: LUX.white, fontSize: 17, fontWeight: '300' },
  rowSub: { color: LUX.grey, fontSize: 13, fontWeight: '300', marginTop: 3 },

  powered: { color: LUX.faint, fontSize: 11, textAlign: 'center', marginTop: 36, letterSpacing: 0.4 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  dialog: {
    width: '100%', maxWidth: 380, backgroundColor: '#0A0A0B', borderRadius: 26,
    borderWidth: 1, borderColor: LUX.hairline, padding: 26,
  },
  dialogTitle: { color: LUX.white, fontSize: 24, fontWeight: '300', letterSpacing: -0.5 },
  dialogRule: { width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.4)', marginVertical: 14 },
  dialogMessage: { color: LUX.grey, fontSize: 15, lineHeight: 22, fontWeight: '300', marginBottom: 24 },
  dialogSecondary: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  dialogSecondaryText: { color: LUX.grey, fontSize: 14, fontWeight: '400' },
});
