import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform,
  Animated, Easing, Image, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { ArrowLeft, Upload, Scan, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/providers/theme-provider';
import { analyzeOnWeb, buildInsights, buildAnalyzerHtml, type ChartInsights } from '@/utils/chart-heuristics';
import { ScanPhases } from '@/components/scan-phases';
import { ConfidenceGauge } from '@/components/confidence-gauge';

const webGlow = (color: string, intense?: boolean) => Platform.OS === 'web' ? ({
  boxShadow: intense
    ? `0 0 12px 3px ${color}99, 0 0 32px 8px ${color}40`
    : `0 0 9px 2px ${color}99, 0 0 24px 6px ${color}40`,
} as any) : {};

export default function ScannerScreen() {
  const { theme } = useTheme();
  const ac = theme.accent;
  const a = theme.accentRgb;

  const [pickedImage, setPickedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [scanLoading, setScanLoading] = useState<boolean>(false);
  const [scanPhase, setScanPhase] = useState<number>(-1);
  const [scanError, setScanError] = useState<string | null>(null);
  const [insights, setInsights] = useState<ChartInsights | null>(null);
  const [analyzerDataUri, setAnalyzerDataUri] = useState<string | null>(null);

  const scanLine = useRef(new Animated.Value(0)).current;
  const signalPulse = useRef(new Animated.Value(0)).current;
  const scanStartedAtRef = useRef<number>(0);
  const scanTargetMsRef = useRef<number>(0);
  const scanRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scanline sweep during loading
  useEffect(() => {
    if (!scanLoading) {
      scanLine.stopAnimation();
      scanLine.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(scanLine, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [scanLoading, scanLine]);

  // Pulse animation for the signal box
  useEffect(() => {
    if (!insights) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(signalPulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(signalPulse, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [insights, signalPulse]);

  // Phase progression while loading
  useEffect(() => {
    if (!scanLoading) {
      setScanPhase(-1);
      return;
    }
    setScanPhase(0);
    const t1 = setTimeout(() => setScanPhase(1), 1500);
    const t2 = setTimeout(() => setScanPhase(2), 3500);
    const t3 = setTimeout(() => setScanPhase(3), 6000);
    const t4 = setTimeout(() => setScanPhase(4), 8500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [scanLoading]);

  const handlePickChartImage = useCallback(async () => {
    try {
      setScanError(null);
      setInsights(null);
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow access to your media library to upload a chart.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: false,
        quality: 0.9,
        base64: Platform.OS !== 'web',
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setPickedImage(result.assets[0]);
      }
    } catch (e) {
      console.error('Pick chart image error:', e);
      setScanError('Could not pick image. Please try again.');
    }
  }, []);

  const revealWhenReady = useCallback((result: ChartInsights) => {
    const elapsed = Date.now() - scanStartedAtRef.current;
    const remaining = Math.max(0, scanTargetMsRef.current - elapsed);
    if (scanRevealTimerRef.current) clearTimeout(scanRevealTimerRef.current);
    scanRevealTimerRef.current = setTimeout(() => {
      scanRevealTimerRef.current = null;
      setInsights(result);
      setScanError(null);
      setScanLoading(false);
    }, remaining);
  }, []);

  const handleScanChart = useCallback(async () => {
    if (!pickedImage) return;
    const targetMs = 6000 + Math.floor(Math.random() * 4001); // 6–10s feel
    scanTargetMsRef.current = targetMs;
    scanStartedAtRef.current = Date.now();
    if (scanRevealTimerRef.current) {
      clearTimeout(scanRevealTimerRef.current);
      scanRevealTimerRef.current = null;
    }
    setScanLoading(true);
    setScanError(null);
    setInsights(null);
    try {
      if (Platform.OS === 'web') {
        const result = await analyzeOnWeb(pickedImage.uri);
        revealWhenReady(result);
      } else {
        const base64 = pickedImage.base64;
        if (!base64) throw new Error('Could not read image data. Please pick the image again.');
        const mime = pickedImage.mimeType || 'image/jpeg';
        setAnalyzerDataUri(`data:${mime};base64,${base64}`);
      }
    } catch (e: any) {
      console.error('Scan chart error:', e);
      setScanError(e?.message || 'Failed to analyze chart. Please try again.');
      setScanLoading(false);
    }
  }, [pickedImage, revealWhenReady]);

  const onAnalyzerMessage = useCallback((event: any) => {
    try {
      const payload = JSON.parse(event?.nativeEvent?.data || '{}');
      if (payload && payload.__error) {
        throw new Error(
          payload.__error === 'image_load_failed'
            ? 'Could not decode the image. Try a PNG/JPG screenshot.'
            : `Analyzer failed (${payload.__error})`
        );
      }
      const result = buildInsights(payload);
      revealWhenReady(result);
    } catch (e: any) {
      console.error('Analyzer message error:', e);
      setScanError(e?.message || 'Analyzer failed. Please try again.');
      setScanLoading(false);
    } finally {
      setAnalyzerDataUri(null);
    }
  }, [revealWhenReady]);

  const renderInsights = (data: ChartInsights) => {
    const signalColor =
      data.signal.action === 'BUY' ? '#22C55E'
      : data.signal.action === 'SELL' ? '#EF4444'
      : '#9CA3AF';
    const signalBg =
      data.signal.action === 'BUY' ? 'rgba(34, 197, 94, 0.12)'
      : data.signal.action === 'SELL' ? 'rgba(239, 68, 68, 0.12)'
      : 'rgba(156, 163, 175, 0.10)';
    const SignalIcon =
      data.signal.action === 'BUY' ? TrendingUp
      : data.signal.action === 'SELL' ? TrendingDown
      : Minus;
    const structureLabel =
      data.trend === 'up' ? 'UPTREND' : data.trend === 'down' ? 'DOWNTREND' : 'SIDEWAYS';
    const strengthBars = data.signal.action === 'WAIT' ? 0
      : data.signal.strength === 'strong' ? 3
      : data.signal.strength === 'moderate' ? 2 : 1;

    const pulseOpacity = signalPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.95] });

    const stats: Array<{ label: string; value: string }> = [
      { label: 'BIAS', value: data.bias === 'bullish' ? 'Bullish' : data.bias === 'bearish' ? 'Bearish' : 'Balanced' },
      { label: 'STRUCTURE', value: data.trend === 'up' ? 'Uptrend' : data.trend === 'down' ? 'Downtrend' : 'Sideways' },
      { label: 'VOLATILITY', value: data.volatility.charAt(0).toUpperCase() + data.volatility.slice(1) },
      { label: 'MOMENTUM', value: data.momentum.charAt(0).toUpperCase() + data.momentum.slice(1) },
    ];

    return (
      <View style={{ gap: 14 }}>
        <View
          style={[
            styles.signalBox,
            { backgroundColor: signalBg, borderColor: signalColor, shadowColor: signalColor },
            webGlow(signalColor, true),
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.signalPulse, { borderColor: signalColor, opacity: pulseOpacity }]}
          />
          <View style={styles.signalRow}>
            <SignalIcon color={signalColor} size={42} strokeWidth={2.5} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.signalHeadline, { color: signalColor }]}>{data.signal.headline}</Text>
              <Text style={[styles.signalMeta, { color: signalColor + 'CC' }]}>
                {data.signal.action === 'WAIT'
                  ? `${structureLabel} • ${data.volatility.toUpperCase()} VOL`
                  : `${data.signal.strength.toUpperCase()} • ${structureLabel} • ${data.volatility.toUpperCase()} VOL`}
              </Text>
              {data.signal.action !== 'WAIT' && (
                <View style={styles.strengthRow}>
                  {[0, 1, 2].map(i => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        { backgroundColor: i < strengthBars ? signalColor : signalColor + '26' },
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
            <ConfidenceGauge value={data.confidence} color={signalColor} label="CONF" />
          </View>
        </View>

        <Text style={styles.summaryText}>{data.signal.rationale}</Text>

        <View style={[styles.balanceBox, { borderColor: ac + '33' }]}>
          <View style={styles.balanceRow}>
            <Text style={[styles.balanceLabel, { color: '#22C55E' }]}>BULLISH</Text>
            <Text style={styles.balanceValue}>{data.bullishPercent}%</Text>
          </View>
          <View style={styles.balanceBarTrack}>
            <View style={[styles.balanceBarBull, { width: `${data.bullishPercent}%` }]} />
          </View>
          <View style={[styles.balanceRow, { marginTop: 10 }]}>
            <Text style={[styles.balanceLabel, { color: '#EF4444' }]}>BEARISH</Text>
            <Text style={styles.balanceValue}>{data.bearishPercent}%</Text>
          </View>
          <View style={styles.balanceBarTrack}>
            <View style={[styles.balanceBarBear, { width: `${data.bearishPercent}%` }]} />
          </View>
        </View>

        <View style={[styles.statsGrid, { borderColor: ac + '22' }]}>
          {stats.map(s => (
            <View key={s.label} style={styles.statCell}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { borderBottomColor: 'rgba(' + a + ', 0.18)' }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color="#FFFFFF" size={20} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ac, textShadowColor: ac + '88' }]}>CHART SCANNER</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Drop your chart screenshot. Local analysis — no AI, no upload.</Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePickChartImage}
          style={[styles.dropzone, { borderColor: ac + '66' }, webGlow(ac)]}
        >
          {pickedImage ? (
            <Image source={{ uri: pickedImage.uri }} style={styles.preview} resizeMode="contain" />
          ) : (
            <View style={styles.dropzoneInner}>
              <Upload color={ac} size={36} />
              <Text style={[styles.dropzoneTitle, { color: ac }]}>TAP TO UPLOAD CHART</Text>
              <Text style={styles.dropzoneSub}>PNG or JPG screenshot of your chart</Text>
            </View>
          )}

          {pickedImage && insights && insights.levels && insights.levels.length > 0 && (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {insights.levels.map((ly, li) => {
                const sc = insights.signal.action === 'BUY' ? '#22C55E'
                  : insights.signal.action === 'SELL' ? '#EF4444' : '#9CA3AF';
                return (
                  <View
                    key={`lvl-${li}`}
                    style={[
                      styles.levelLine,
                      { top: `${Math.max(2, Math.min(98, ly * 100))}%`, borderColor: sc, shadowColor: sc },
                      webGlow(sc, true),
                    ]}
                  >
                    <View style={[styles.levelTag, { backgroundColor: sc + 'E6' }]}>
                      <Text style={styles.levelTagText}>L{li + 1}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {scanLoading && pickedImage && (
            <>
              <View pointerEvents="none" style={styles.scanVeil} />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.scanLine,
                  {
                    backgroundColor: ac, shadowColor: ac,
                    transform: [{ translateY: scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, 260] }) }],
                  },
                  webGlow(ac, true),
                ]}
              />
            </>
          )}
        </TouchableOpacity>

        {pickedImage && !scanLoading && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={handlePickChartImage}
              activeOpacity={0.8}
              style={[styles.secondaryBtn, { borderColor: ac + '66' }]}
            >
              <RefreshCw color={ac} size={16} />
              <Text style={[styles.secondaryText, { color: ac }]}>CHANGE IMAGE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleScanChart}
              activeOpacity={0.8}
              style={[styles.primaryBtn, { borderColor: ac, shadowColor: ac }, webGlow(ac, true)]}
            >
              <Scan color={ac} size={18} />
              <Text style={[styles.primaryText, { color: ac }]}>SCAN CHART</Text>
            </TouchableOpacity>
          </View>
        )}

        {pickedImage && scanLoading && (
          <View style={[styles.phasesBox, { borderColor: ac + '66' }, webGlow(ac)]}>
            <View style={styles.phasesHeader}>
              <ActivityIndicator color={ac} size="small" />
              <Text style={[styles.phasesTitle, { color: ac }]}>ANALYZING CHART</Text>
            </View>
            <ScanPhases phase={scanPhase} color={ac} />
          </View>
        )}

        {scanError && (
          <View style={[styles.errorBox, { borderColor: '#FF4D4D' }]}>
            <Text style={styles.errorText}>{scanError}</Text>
          </View>
        )}

        {insights && (
          <View style={[styles.resultBox, { borderColor: ac + '66' }, webGlow(ac)]}>
            <Text style={[styles.resultTitle, { color: ac }]}>CHART DIAGNOSTICS</Text>
            {renderInsights(insights)}
          </View>
        )}
      </ScrollView>

      {Platform.OS !== 'web' && analyzerDataUri && (
        <WebView
          source={{ html: buildAnalyzerHtml(analyzerDataUri) }}
          onMessage={onAnalyzerMessage}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          style={styles.hiddenWebView}
          pointerEvents="none"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: 1.5,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  headerSpacer: { width: 40 },
  body: { padding: 16, paddingBottom: 48, gap: 14 },
  intro: { color: 'rgba(255,255,255,0.55)', fontSize: 13, letterSpacing: 0.4 },
  dropzone: {
    height: 280, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed' as any,
    backgroundColor: 'rgba(10,10,12,0.65)', overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  dropzoneInner: { alignItems: 'center', gap: 10, padding: 20 },
  dropzoneTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginTop: 6 },
  dropzoneSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 0.3 },
  preview: { width: '100%', height: '100%' },
  scanVeil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  scanLine: {
    position: 'absolute', left: 0, right: 0, top: 0, height: 2,
    shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  levelLine: {
    position: 'absolute', left: 8, right: 8, height: 0,
    borderTopWidth: 1.5, borderStyle: 'dashed' as any,
    shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  levelTag: {
    position: 'absolute', right: 0, top: -10, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4,
  },
  levelTagText: { color: '#000', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1.25,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  secondaryText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1.75,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  primaryText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  phasesBox: {
    borderRadius: 14, borderWidth: 1.25, padding: 16,
    backgroundColor: 'rgba(10,10,12,0.7)', gap: 12,
  },
  phasesHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phasesTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  errorBox: {
    borderRadius: 12, borderWidth: 1.25, padding: 12,
    backgroundColor: 'rgba(255,77,77,0.08)',
  },
  errorText: { color: '#FF8080', fontSize: 12, letterSpacing: 0.3 },
  resultBox: {
    borderRadius: 18, borderWidth: 1.5, padding: 16,
    backgroundColor: 'rgba(10,10,12,0.7)', gap: 12,
  },
  resultTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  signalBox: {
    borderRadius: 16, borderWidth: 1.75, padding: 16,
    shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    overflow: 'hidden', position: 'relative',
  },
  signalPulse: {
    position: 'absolute', top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 12, borderWidth: 1.5,
  },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  signalHeadline: {
    fontSize: 17, fontWeight: '900', letterSpacing: 0.4,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
  },
  signalMeta: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 4 },
  strengthRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  strengthBar: { width: 24, height: 4, borderRadius: 2 },
  summaryText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18, letterSpacing: 0.2 },
  balanceBox: {
    borderRadius: 12, borderWidth: 1, padding: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  balanceLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  balanceValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  balanceBarTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  balanceBarBull: { height: '100%', backgroundColor: '#22C55E' },
  balanceBarBear: { height: '100%', backgroundColor: '#EF4444' },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  statCell: { width: '47%', gap: 4 },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  statValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  hiddenWebView: { width: 1, height: 1, opacity: 0, position: 'absolute' },
});
