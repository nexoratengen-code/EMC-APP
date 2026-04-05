import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/providers/theme-provider';

const SCANNER_URL = 'https://fxsynapse-ai.vercel.app/partner/trade-port-scanner';

export default function ScannerScreen() {
  const { theme } = useTheme();
  const ac = theme.accent;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color="#FFFFFF" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chart Scanner</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.webviewContainer}>
        {Platform.OS === 'web' ? (
          <iframe
            src={SCANNER_URL}
            style={{ width: '100%', height: '100%', border: '0', borderRadius: 0 } as any}
            loading="eager"
            allow="clipboard-write"
          />
        ) : (
          <WebView
            source={{ uri: SCANNER_URL }}
            style={styles.webview}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
  },
  headerSpacer: {
    width: 40,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
