import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, ScrollView, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowLeft, ChevronDown, Trash2, Check } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/providers/app-provider';
import { useTheme } from '@/providers/theme-provider';
import { PageBackground } from '@/components/page-background';

interface TradeConfig {
  lotSize: string;
  direction: 'BUY' | 'SELL' | 'BOTH';
  platform: 'MT4' | 'MT5';
  numberOfTrades: string;
}

export default function TradeConfigScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { activeSymbols, activateSymbol, deactivateSymbol, mt4Symbols, mt5Symbols, activateMT4Symbol, activateMT5Symbol, deactivateMT4Symbol, deactivateMT5Symbol, eas } = useApp() as any;
  const { theme } = useTheme();
  const ac = theme.accent;
  const a = theme.accentRgb;

  const primaryEA = Array.isArray(eas) && eas.length > 0 ? eas[0] : null;
  const primaryEAImage = (() => {
    if (!primaryEA || !primaryEA.userData || !primaryEA.userData.owner) return null;
    const raw = (primaryEA.userData.owner.logo || '').toString().trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return 'https://eamobileconnect.com/admin/uploads/' + raw.replace(/^\/+/, '');
  })();

  const [config, setConfig] = useState<TradeConfig>({
    lotSize: '0.01',
    direction: 'BOTH',
    platform: 'MT5',
    numberOfTrades: '1'
  });

  const isSymbolActive = config.platform === 'MT4'
    ? mt4Symbols.some((s: any) => s.symbol === symbol)
    : mt5Symbols.some((s: any) => s.symbol === symbol);

  const legacySymbolActive = activeSymbols.some((s: any) => s.symbol === symbol);
  const legacySymbolConfig = activeSymbols.find((s: any) => s.symbol === symbol);

  useEffect(() => {
    const loadInitialConfig = () => {
      if (legacySymbolConfig) {
        setConfig({
          lotSize: legacySymbolConfig.lotSize,
          direction: 'BOTH',
          platform: legacySymbolConfig.platform,
          numberOfTrades: legacySymbolConfig.numberOfTrades
        });
        return;
      }
      const mt5Config = mt5Symbols.find((s: any) => s.symbol === symbol);
      if (mt5Config) {
        setConfig(prev => ({ ...prev, lotSize: mt5Config.lotSize, direction: 'BOTH', platform: 'MT5', numberOfTrades: mt5Config.numberOfTrades }));
        return;
      }
      const mt4Config = mt4Symbols.find((s: any) => s.symbol === symbol);
      if (mt4Config) {
        setConfig(prev => ({ ...prev, lotSize: mt4Config.lotSize, direction: 'BOTH', platform: 'MT4', numberOfTrades: mt4Config.numberOfTrades }));
        return;
      }
      setConfig(prev => ({ ...prev, lotSize: '0.01', direction: 'BOTH', platform: 'MT5', numberOfTrades: '1' }));
    };
    loadInitialConfig();
  }, [symbol, mt4Symbols, mt5Symbols, legacySymbolConfig]);

  const [showPlatformModal, setShowPlatformModal] = useState(false);

  const handleBack = () => router.back();

  const handleSetSymbol = () => {
    if (!symbol) return;
    activateSymbol({ symbol, lotSize: config.lotSize, direction: config.direction, platform: config.platform, numberOfTrades: config.numberOfTrades });
    if (config.platform === 'MT4') {
      activateMT4Symbol({ symbol, lotSize: config.lotSize, direction: config.direction, numberOfTrades: config.numberOfTrades });
    } else {
      activateMT5Symbol({ symbol, lotSize: config.lotSize, direction: config.direction, numberOfTrades: config.numberOfTrades });
    }
    router.back();
  };

  const handleRemoveSymbol = () => {
    if (!symbol) return;
    deactivateSymbol(symbol);
    if (config.platform === 'MT4') deactivateMT4Symbol(symbol);
    else deactivateMT5Symbol(symbol);
    router.back();
  };

  const updateConfig = (key: keyof TradeConfig, value: string) => {
    setConfig(prev => {
      const newConfig = { ...prev, [key]: value };
      if (key === 'platform' && symbol) {
        const targetPlatform = value as 'MT4' | 'MT5';
        if (targetPlatform === 'MT4') {
          const mt4Config = mt4Symbols.find((s: any) => s.symbol === symbol);
          if (mt4Config) return { ...newConfig, lotSize: mt4Config.lotSize, direction: 'BOTH', numberOfTrades: mt4Config.numberOfTrades };
        } else {
          const mt5Config = mt5Symbols.find((s: any) => s.symbol === symbol);
          if (mt5Config) return { ...newConfig, lotSize: mt5Config.lotSize, direction: 'BOTH', numberOfTrades: mt5Config.numberOfTrades };
        }
        return { ...newConfig, lotSize: '0.01', direction: 'BOTH', numberOfTrades: '1' };
      }
      return newConfig;
    });
  };

  const webGlow = (color: string, intense?: boolean) => Platform.OS === 'web' ? ({
    boxShadow: intense ? `0 0 12px 3px ${color}99, 0 0 32px 8px ${color}40` : `0 0 8px 1px ${color}66, 0 0 18px 4px ${color}30`,
  } as any) : {};

  const isUpdate = isSymbolActive || legacySymbolActive;

  return (
    <SafeAreaView style={styles.container}>
      <PageBackground eaImage={primaryEAImage} />

      <View style={[styles.header, { borderBottomColor: 'rgba(' + a + ', 0.18)' }]}>
        <TouchableOpacity style={[styles.backButton, { borderColor: 'rgba(' + a + ', 0.3)' }]} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft color="#FFFFFF" size={20} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: ac, textShadowColor: ac + '88' }]}>TRADE CONFIG</Text>
          <Text style={styles.symbolText}>{symbol}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.configSection}>
            <Text style={[styles.sectionTitle, { color: ac }]}>LOT SIZE</Text>
            <TextInput
              style={[styles.input, { borderColor: 'rgba(' + a + ', 0.4)' }, webGlow(ac)]}
              value={config.lotSize}
              onChangeText={(value) => updateConfig('lotSize', value)}
              keyboardType="decimal-pad"
              placeholder="0.01"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          </View>

          <View style={styles.configSection}>
            <Text style={[styles.sectionTitle, { color: ac }]}>PLATFORM</Text>
            <TouchableOpacity
              style={[styles.picker, { borderColor: 'rgba(' + a + ', 0.4)' }, webGlow(ac)]}
              onPress={() => setShowPlatformModal(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.pickerText}>{config.platform}</Text>
              <ChevronDown color={ac} size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.configSection}>
            <Text style={[styles.sectionTitle, { color: ac }]}>NUMBER OF TRADES</Text>
            <TextInput
              style={[styles.input, { borderColor: 'rgba(' + a + ', 0.4)' }, webGlow(ac)]}
              value={config.numberOfTrades}
              onChangeText={(value) => updateConfig('numberOfTrades', value)}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.executeButton, { borderColor: ac, backgroundColor: 'rgba(' + a + ', 0.18)' }, webGlow(ac, true)]}
              onPress={handleSetSymbol}
              activeOpacity={0.85}
            >
              <Check color={ac} size={18} />
              <Text style={[styles.executeButtonText, { color: ac, textShadowColor: ac + '88' }]}>
                {isUpdate ? 'UPDATE SYMBOL' : 'SET SYMBOL'}
              </Text>
            </TouchableOpacity>

            {isUpdate && (
              <TouchableOpacity
                style={[styles.removeButton, { borderColor: 'rgba(255,68,68,0.6)' }, Platform.OS === 'web' && { boxShadow: '0 0 6px 1px rgba(255,68,68,0.35)' } as any]}
                onPress={handleRemoveSymbol}
                activeOpacity={0.8}
              >
                <Trash2 color="#FF4D4D" size={18} />
                <Text style={styles.removeButtonText}>REMOVE</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showPlatformModal} transparent animationType="fade" onRequestClose={() => setShowPlatformModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPlatformModal(false)}>
          <View style={[styles.modalContent, { borderColor: ac }, webGlow(ac, true)]}>
            <Text style={[styles.modalTitle, { color: ac }]}>Select Platform</Text>
            {['MT4', 'MT5'].map((platform) => {
              const active = config.platform === platform;
              return (
                <TouchableOpacity
                  key={platform}
                  style={[styles.modalOption, active && { backgroundColor: 'rgba(' + a + ', 0.15)' }]}
                  onPress={() => { updateConfig('platform', platform as 'MT4' | 'MT5'); setShowPlatformModal(false); }}
                >
                  <Text style={[styles.modalOptionText, active && { color: ac, fontWeight: '700' }]}>{platform}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  keyboardAvoidingView: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1.5,
  },
  backButton: {
    marginRight: 14, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.25,
    alignItems: 'center', justifyContent: 'center',
  },
  headerContent: { flex: 1 },
  headerTitle: {
    fontSize: 17, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  symbolText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  configSection: { marginBottom: 22 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(15,15,18,0.7)',
    borderWidth: 1.25, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    color: '#FFFFFF', fontSize: 16, fontWeight: '600',
    ...(Platform.OS === 'web' && { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any),
  },
  picker: {
    backgroundColor: 'rgba(15,15,18,0.7)',
    borderWidth: 1.25, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    ...(Platform.OS === 'web' && { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any),
  },
  pickerText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  modalContent: {
    backgroundColor: 'rgba(15,15,18,0.92)',
    borderRadius: 18, borderWidth: 1.5,
    paddingVertical: 18, width: '100%', maxWidth: 320,
    ...(Platform.OS === 'web' && { backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)' } as any),
  },
  modalTitle: { fontSize: 14, fontWeight: '800', textAlign: 'center', marginBottom: 14, letterSpacing: 1.2 },
  modalOption: { paddingHorizontal: 24, paddingVertical: 14 },
  modalOptionText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '600', textAlign: 'center', letterSpacing: 0.5 },
  buttonContainer: { marginTop: 20, marginBottom: 32, gap: 12 },
  executeButton: {
    borderRadius: 16, borderWidth: 1.75,
    paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10,
  },
  executeButtonText: { fontSize: 14, fontWeight: '800', letterSpacing: 1.2, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  removeButton: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1.25, borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  removeButtonText: { color: '#FF4D4D', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
});
