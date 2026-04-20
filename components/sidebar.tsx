import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Platform, TouchableWithoutFeedback, Image, ScrollView } from 'react-native';
import { Home, TrendingUp, Settings, X, BarChart3, Plus, EyeOff, Droplet } from 'lucide-react-native';
import { router, usePathname } from 'expo-router';
import { useSidebar } from '@/providers/sidebar-provider';
import { useTheme } from '@/providers/theme-provider';
import { useApp } from '@/providers/app-provider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = 300;

const NAV_ITEMS = [
  { key: '/', label: 'Home', icon: Home, route: '/' },
  { key: '/metatrader', label: 'MetaTrader', icon: TrendingUp, route: '/metatrader' },
  { key: '/settings', label: 'Settings', icon: Settings, route: '/settings' },
];

const GLOW_PRESETS = [
  '#00BFFF', // cyan
  '#A855F7', // purple
  '#00FF88', // green
  '#FF3366', // pink
  '#FF6B00', // orange
  '#FFD700', // gold
  '#FF00FF', // magenta
  '#EF4444', // red
  '#3B82F6', // electric blue
  '#14B8A6', // teal
  '#84CC16', // lime
  '#00FFCC', // aqua
  '#EC4899', // hot pink
  '#FFFFFF', // white
];

const getEAImageUrl = (ea: any): string | null => {
  if (!ea || !ea.userData || !ea.userData.owner) return null;
  const raw = (ea.userData.owner.logo || '').toString().trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return 'https://eamobileconnect.com/admin/uploads/' + raw.replace(/^\/+/, '');
};

export function Sidebar() {
  const { isOpen, close } = useSidebar();
  const { theme } = useTheme();
  const { eas, isBotActive, heroHidden, setHeroHidden, glowColor, setGlowColor } = useApp();
  const a = theme.accentRgb;
  const ac = theme.accent;
  const pathname = usePathname();

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: -SIDEBAR_WIDTH, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [isOpen]);

  const handleNav = useCallback((route: string) => {
    close();
    setTimeout(() => { router.push(route as any); }, 100);
  }, [close]);

  const primaryEA = Array.isArray(eas) && eas.length > 0 ? eas[0] : null;
  const primaryEAImage = getEAImageUrl(primaryEA);

  return (
    <>
      <Animated.View pointerEvents={isOpen ? 'auto' : 'none'} style={[styles.overlay, { opacity: overlayAnim }]}>
        <TouchableWithoutFeedback onPress={close}>
          <View style={styles.overlayTouch} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.sidebarShine} />
        <View style={styles.sidebarEdge} />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>EA MOBILE CONNECT</Text>
          <TouchableOpacity onPress={close} style={styles.closeBtn}>
            <X color="rgba(255,255,255,0.6)" size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {primaryEA && (
            <View style={[
              styles.eaPill,
              { borderColor: glowColor + '66' },
              Platform.OS === 'web' && { boxShadow: `0 0 9px 2px ${glowColor}99, 0 0 24px 6px ${glowColor}40` } as any,
            ]}>
              <View style={styles.eaPillImageWrap}>
                {primaryEAImage ? (
                  <Image source={{ uri: primaryEAImage }} style={styles.eaPillImage} resizeMode="cover" />
                ) : (
                  <Image source={require('../assets/images/icon.png')} style={styles.eaPillImage} resizeMode="contain" />
                )}
              </View>
              <View style={styles.eaPillText}>
                <Text style={styles.eaPillName} numberOfLines={1}>{primaryEA.name}</Text>
                <Text style={[styles.eaPillStatus, { color: isBotActive ? '#16A34A' : 'rgba(255,255,255,0.4)' }]}>
                  {isBotActive ? 'RUNNING' : 'IDLE'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.navList}>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.key ||
                (item.key === '/' && pathname === '/index') ||
                (item.key === '/' && pathname === '');
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.navItem,
                    isActive && styles.navItemActive,
                    isActive && { backgroundColor: 'rgba(' + a + ', 0.12)' },
                    isActive && Platform.OS === 'web' && { boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.15), 0 0 12px rgba(' + a + ', 0.15)' },
                  ]}
                  onPress={() => handleNav(item.route)}
                  activeOpacity={0.6}
                >
                  <View style={[styles.navIconWrap, isActive && { backgroundColor: 'rgba(' + a + ', 0.2)', borderColor: 'rgba(' + a + ', 0.3)' }]}>
                    <Icon color={isActive ? ac : 'rgba(255,255,255,0.5)'} size={18} />
                  </View>
                  <Text style={[styles.navLabel, isActive && { color: '#FFFFFF' }]}>{item.label}</Text>
                  {isActive && <View style={[styles.activeIndicator, { backgroundColor: ac }]} />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.navItem, { borderColor: glowColor + '44' }]}
              onPress={() => handleNav('/(tabs)/scanner')}
              activeOpacity={0.6}
            >
              <View style={[styles.navIconWrap, { borderColor: glowColor + '44' }]}>
                <BarChart3 color={glowColor} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.navLabel, { color: glowColor }]}>Chart Scanner</Text>
                <Text style={styles.navSub}>AI-POWERED TRADE ANALYSIS</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, { borderColor: glowColor + '44' }]}
              onPress={() => handleNav('/license')}
              activeOpacity={0.6}
            >
              <View style={[styles.navIconWrap, { borderColor: glowColor + '44' }]}>
                <Plus color={glowColor} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.navLabel, { color: glowColor }]}>Add New EA</Text>
                <Text style={styles.navSub}>HAVE A VALID LICENSE KEY</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>APPEARANCE</Text>

          <TouchableOpacity
            style={styles.toggleRow}
            activeOpacity={0.7}
            onPress={() => setHeroHidden(!heroHidden)}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <EyeOff color={heroHidden ? glowColor : 'rgba(255,255,255,0.5)'} size={14} />
                <Text style={styles.toggleLabel}>Hide Hero Image</Text>
              </View>
              <Text style={styles.toggleSub}>Shows robot backdrop only</Text>
            </View>
            <View style={[styles.toggleTrack, { backgroundColor: heroHidden ? glowColor : 'rgba(255,255,255,0.15)' }]}>
              <View style={[styles.toggleThumb, { transform: [{ translateX: heroHidden ? 16 : 0 }] }]} />
            </View>
          </TouchableOpacity>

          <View style={styles.glowRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Droplet color={glowColor} size={14} />
              <Text style={styles.toggleLabel}>Glow Color</Text>
            </View>
            <View style={styles.swatchGrid}>
              {GLOW_PRESETS.map((c) => {
                const active = c.toLowerCase() === glowColor.toLowerCase();
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setGlowColor(c)}
                    activeOpacity={0.75}
                    style={[
                      styles.swatch,
                      { backgroundColor: c, borderColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.15)' },
                      active && Platform.OS === 'web' && { boxShadow: `0 0 10px 2px ${c}cc, 0 0 20px 4px ${c}66` } as any,
                    ]}
                  />
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.sidebarFooter}>
          <View style={[styles.footerDot, { backgroundColor: glowColor }]} />
          <Text style={styles.footerText}>v1.0</Text>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 998 },
  overlayTouch: { flex: 1 },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: 'rgba(15, 15, 15, 0.9)',
    zIndex: 999,
    borderRightWidth: 2,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderRightColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 60,
    paddingBottom: 30,
    overflow: 'hidden',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(60px) saturate(180%)',
      WebkitBackdropFilter: 'blur(60px) saturate(180%)',
      boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.15), 8px 0 40px rgba(0,0,0,0.5)',
    }),
  },
  sidebarShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '40%', borderTopRightRadius: 28,
    ...(Platform.OS === 'web' && {
      background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 60%, rgba(255,255,255,0) 100%)',
      pointerEvents: 'none',
    }),
  },
  sidebarEdge: {
    position: 'absolute', top: 60, right: 0, width: 2, bottom: 30,
    ...(Platform.OS === 'web' && {
      background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.15) 100%)',
      pointerEvents: 'none',
    }),
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20, paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1.5 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  eaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 16, borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.4)', marginBottom: 16,
  },
  eaPillImageWrap: {
    width: 40, height: 40, borderRadius: 12, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  eaPillImage: { width: '100%', height: '100%' },
  eaPillText: { flex: 1 },
  eaPillName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
  eaPillStatus: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  navList: { gap: 6, marginBottom: 18 },
  navItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 16, borderWidth: 1, borderColor: 'transparent',
  },
  navItemActive: {
    borderWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.2)',
    borderLeftColor: 'rgba(255,255,255,0.12)',
    borderRightColor: 'rgba(255,255,255,0.08)',
    borderBottomColor: 'rgba(0,0,0,0.15)',
    ...(Platform.OS === 'web' && { backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }),
  },
  navIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
    marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  navLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3, flex: 1 },
  navSub: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.8, marginTop: 2 },
  activeIndicator: { width: 6, height: 6, borderRadius: 3 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2, marginTop: 6, marginBottom: 12, paddingHorizontal: 4,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.3 },
  toggleSub: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3, letterSpacing: 0.3 },
  toggleTrack: {
    width: 34, height: 18, borderRadius: 9,
    padding: 2, justifyContent: 'center',
  },
  toggleThumb: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF',
  },
  glowRow: {
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  sidebarFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingTop: 8,
  },
  footerDot: { width: 6, height: 6, borderRadius: 3 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 },
});
