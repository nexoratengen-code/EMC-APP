import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform,
  Animated, Easing, Image, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { ArrowLeft, Upload, Scan, RefreshCw, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/providers/theme-provider';
import { analyzeOnWeb, buildInsights, buildAnalyzerHtml, type ChartInsights } from '@/utils/chart-heuristics';
import { ScanPhases } from '@/components/scan-phases';
import { ConfidenceGauge } from '@/components/confidence-gauge';
import { Typewriter } from '@/components/typewriter';
import { ParticleBurst } from '@/components/particle-burst';

const SIGNAL_TTL_MS = 15 * 60 * 1000;

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

  // Signal freshness + reveal effects
  const [signalAt, setSignalAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [revealCount, setRevealCount] = useState<number>(0);

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
      Animated.timing(scanLine, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [scanLoading, scanLine]);

  // Pulse animation for the signal box
  useEffect(() => {
    if (!insights) {
      signalPulse.stopAnimation();
      signalPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(signalPulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(signalPulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [insights, signalPulse]);

  // Phase progression while loading — purely visual, caps at 3 so the last
  // phase ("BUILDING SIGNAL") stays lit until the result actually lands.
  useEffect(() => {
    if (!scanLoading) return;
    const target = scanTargetMsRef.current || 8000;
    const step = Math.max(900, Math.floor(target / 4));
    const id = setInterval(() => {
      setScanPhase(p => (p < 3 ? p + 1 : p));
    }, step);
    return () => clearInterval(id);
  }, [scanLoading]);

  // When a result lands, mark all phases done briefly, then idle.
  useEffect(() => {
    if (!insights) return;
    setScanPhase(4);
    const id = setTimeout(() => setScanPhase(-1), 700);
    return () => clearTimeout(id);
  }, [insights]);

  // 15-minute countdown ticker. Only runs while we have a live signal.
  useEffect(() => {
    if (!signalAt) return;
    setNowTick(Date.now());
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [signalAt]);

  // Haptic + soft beep the moment a result reveals.
  useEffect(() => {
    if (!insights) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }
    try {
      const w = window as any;
      const Ctor = w.AudioContext || w.webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
      osc.onended = () => { try { ctx.close(); } catch {} };
    } catch {}
  }, [insights]);

  const handlePickChartImage = useCallback(async () => {
    try {
      setScanError(null);
      setInsights(null);
      setSignalAt(null);
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

  // Pushes a freshly computed insight into state + fires reveal effects.
  const commitInsights = useCallback((result: ChartInsights) => {
    setInsights(result);
    setScanError(null);
    setSignalAt(Date.now());
    setRevealCount(c => c + 1);
  }, []);

  const revealWhenReady = useCallback((result: ChartInsights) => {
    const elapsed = Date.now() - scanStartedAtRef.current;
    const remaining = Math.max(0, scanTargetMsRef.current - elapsed);
    if (scanRevealTimerRef.current) clearTimeout(scanRevealTimerRef.current);
    scanRevealTimerRef.current = setTimeout(() => {
      scanRevealTimerRef.current = null;
      commitInsights(result);
      setScanLoading(false);
    }, remaining);
  }, [commitInsights]);

  const handleScanChart = useCallback(async () => {
    if (!pickedImage) return;
    const targetMs = 10000 + Math.floor(Math.random() * 10001); // 10–20s cinematic feel
    scanTargetMsRef.current = targetMs;
    scanStartedAtRef.current = Date.now();
    if (scanRevealTimerRef.current) {
      clearTimeout(scanRevealTimerRef.current);
      scanRevealTimerRef.current = null;
    }
    setScanLoading(true);
    setScanError(null);
    setInsights(null);
    setSignalAt(null);
    setScanPhase(0);
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
      setScanPhase(-1);
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
      setScanPhase(-1);
    } finally {
      setAnalyzerDataUri(null);
    }
  }, [revealWhenReady]);

  const formatCountdown = (ms: number): string => {
    const total = Math.max(0, Math.round(ms / 1000));
    const mm = Math.floor(total / 60);
    const ss = total % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  const renderInsights = (data: ChartInsights) => {
    const statRows: Array<{ label: string; value: string }> = [
      { label: 'BIAS', value: data.bias === 'bullish' ? 'Bullish' : data.bias === 'bearish' ? 'Bearish' : 'Balanced' },
      { label: 'STRUCTURE', value: data.trend === 'up' ? 'Uptrend' : data.trend === 'down' ? 'Downtrend' : 'Sideways range' },
      { label: 'VOLATILITY', value: data.volatility.charAt(0).toUpperCase() + data.volatility.slice(1) },
      { label: 'MOMENTUM', value: data.momentum.charAt(0).toUpperCase() + data.momentum.slice(1) },
    ];

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
    const pulseScale = signalPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });

    return (
      <View style={{ gap: 14 }}>
        {/* ── Large signal hero with pulsing glow ─────────────────── */}
        <Animated.View
          style={[
            styles.signalBox,
            { backgroundColor: signalBg, borderColor: signalColor, shadowColor: signalColor, transform: [{ scale: pulseScale }] },
            webGlow(signalColor, true),
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.signalPulse, { borderColor: signalColor, opacity: pulseOpacity }]}
          />
          <View style={styles.signalRow}>
            <SignalIcon color={signalColor} size={44} strokeWidth={2.5} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.signalHeadline, { color: signalColor, textShadowColor: signalColor + 'B3' }]}>
                {data.signal.headline}
              </Text>
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
                        { backgroundColor: i < strengthBars ? signalColor : signalColor + '26', shadowColor: signalColor },
                        i < strengthBars && webGlow(signalColor, true),
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
            <ConfidenceGauge value={data.confidence} color={signalColor} label="CONF" />
          </View>

          <Typewriter
            text={data.signal.rationale}
            speed={14}
            startDelay={120}
            style={styles.signalRationale}
          />

          {/* Particle burst each time a new signal lands */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <ParticleBurst trigger={revealCount} color={signalColor} count={16} radius={150} />
          </View>

          {/* 15-minute freshness countdown */}
          {signalAt && (
            <View style={styles.countdownWrap}>
              <View style={styles.countdownLabelRow}>
                <Clock color={signalColor + 'CC'} size={12} strokeWidth={2.5} />
                <Text style={[styles.countdownLabel, { color: signalColor + 'CC' }]}>
                  SIGNAL FRESH FOR {formatCountdown(Math.max(0, SIGNAL_TTL_MS - (nowTick - signalAt)))}
                </Text>
              </View>
              <View style={styles.countdownTrack}>
                <View
                  style={[
                    styles.countdownFill,
                    {
                      backgroundColor: signalColor,
                      width: `${Math.max(0, Math.min(100, 100 - ((nowTick - signalAt) / SIGNAL_TTL_MS) * 100))}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </Animated.View>

        {/* ── Supporting diagnostics ───────────────────────────────── */}
        <Text style={styles.resultText}>{data.summary}</Text>

        <View style={styles.mixRow}>
          <View style={[styles.mixBar, { flex: Math.max(1, data.bullishPercent), backgroundColor: '#22C55E' }]} />
          <View style={[styles.mixBar, { flex: Math.max(1, data.bearishPercent), backgroundColor: '#EF4444' }]} />
        </View>
        <View style={styles.mixLabels}>
          <Text style={styles.mixLabel}>{data.bullishPercent}% bullish</Text>
          <Text style={styles.mixLabel}>{data.bearishPercent}% bearish</Text>
        </View>

        <View style={{ gap: 8, marginTop: 4 }}>
          {statRows.map(row => (
            <View key={row.label} style={styles.resultRow}>
              <Text style={[styles.resultLabel, { color: ac }]}>{row.label}</Text>
              <Text style={styles.resultText}>{row.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          Descriptive chart diagnostics only — not financial advice or a trade recommendation.
        </Text>
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

        {/* Upload / Preview area */}
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

          {/* Detected horizontal levels — dashed lines over the preview */}
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

          {/* Scan-line sweep during analysis */}
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

      {/* Hidden native-only analyzer: renders the image on a canvas and posts back pixel stats. */}
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
  scanVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  scanLine: {
    position: 'absolute', left: 0, right: 0, top: 0, height: 2,
    shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  levelLine: {
    position: 'absolute', left: 10, right: 10, height: 0,
    borderTopWidth: 1, borderStyle: 'dashed' as any,
    shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  levelTag: {
    position: 'absolute', left: 0, top: -8, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4,
  },
  levelTagText: { color: '#000', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
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
    borderRadius: 16, borderWidth: 1, padding: 16,
    backgroundColor: '#080D1A', gap: 6,
  },
  phasesHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  phasesTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  errorBox: {
    borderRadius: 12, borderWidth: 1.25, padding: 12,
    backgroundColor: 'rgba(255,77,77,0.08)',
  },
  errorText: { color: '#FF8080', fontSize: 12, letterSpacing: 0.3 },
  resultBox: {
    borderRadius: 16, borderWidth: 1.5, padding: 16,
    backgroundColor: '#080D1A', gap: 12,
  },
  resultTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  resultRow: { gap: 2 },
  resultLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  resultText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  signalBox: {
    position: 'relative', borderRadius: 20, borderWidth: 2,
    paddingVertical: 20, paddingHorizontal: 20, gap: 14, overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 12,
  },
  signalPulse: {
    position: 'absolute', top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 16, borderWidth: 1,
  },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  signalHeadline: {
    fontSize: 32, fontWeight: '900', letterSpacing: 2,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
  signalMeta: { marginTop: 3, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  strengthRow: { flexDirection: 'row', gap: 5, marginTop: 10 },
  strengthBar: {
    width: 22, height: 6, borderRadius: 3,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4,
  },
  signalRationale: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500', lineHeight: 19 },
  mixRow: {
    flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  mixBar: { height: '100%' },
  mixLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  mixLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  countdownWrap: { marginTop: 6, gap: 6 },
  countdownLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countdownLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  countdownTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  countdownFill: { height: '100%', borderRadius: 2 },
  disclaimer: {
    marginTop: 6, color: 'rgba(255,255,255,0.45)', fontSize: 10,
    fontWeight: '500', fontStyle: 'italic', lineHeight: 14,
  },
  hiddenWebView: { width: 1, height: 1, opacity: 0, position: 'absolute' },
});
