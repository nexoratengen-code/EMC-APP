import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeName = 'pink' | 'gold' | 'silver' | 'white' | 'teal' | 'lime' | 'magenta' | 'crimson' | 'violet' | 'amber';
export type GlassMode = 'neon' | 'minimal' | 'liquid' | 'commander' | 'mech';
export type FontFamily = 'system' | 'mono' | 'rounded' | 'condensed' | 'serif' | 'grotesk' | 'jetbrains' | 'outfit' | 'sora' | 'tight';
export type HeroStyle = 'square' | 'circle';
export type TextCase = 'normal' | 'upper' | 'lower' | 'capitalize';
export type BgType = 'robot' | 'video1' | 'video2' | 'video3' | 'video4' | 'custom' | 'off';
export type CardBgMode = 'thumbnail' | 'fullcover';
export type CardShape = 'rounded' | 'pill' | 'superpill';

const FONT_MAP: Record<FontFamily, string> = {
  system: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
  mono: '"Fira Code", "SF Mono", "Courier New", monospace',
  rounded: '"Nunito", "SF Pro Rounded", system-ui, sans-serif',
  condensed: '"Roboto Condensed", "SF Pro Condensed", system-ui, sans-serif',
  serif: '"Playfair Display", "New York", "Georgia", serif',
  grotesk: '"Space Grotesk", system-ui, sans-serif',
  jetbrains: '"JetBrains Mono", monospace',
  outfit: '"Outfit", system-ui, sans-serif',
  sora: '"Sora", system-ui, sans-serif',
  tight: '"Inter Tight", system-ui, sans-serif',
};

const TEXT_CASE_MAP: Record<TextCase, string> = {
  normal: 'none', upper: 'uppercase', lower: 'lowercase', capitalize: 'capitalize',
};

const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Nunito:wght@400;600;700;800;900&family=Roboto+Condensed:wght@400;500;600;700;800&family=Playfair+Display:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&family=Sora:wght@400;500;600;700;800&family=Inter+Tight:wght@400;500;600;700;800;900&display=swap';

export interface ThemeColors {
  accent: string; accentRgb: string; accentLight: string; accentGlow: string; gradientStart: string; textMuted: string;
}

const THEMES: Record<ThemeName, ThemeColors> = {
  pink:    { accent: '#FF4DA6', accentRgb: '255, 77, 166',  accentLight: '#FFB3D9', accentGlow: '#FF4DA6', gradientStart: 'rgba(255, 77, 166,',  textMuted: 'rgba(255, 179, 217, 0.6)' },
  gold:    { accent: '#FFD700', accentRgb: '255, 215, 0',   accentLight: '#FFEB99', accentGlow: '#FFD700', gradientStart: 'rgba(255, 215, 0,',   textMuted: 'rgba(255, 235, 153, 0.6)' },
  silver:  { accent: '#C0C5CE', accentRgb: '192, 197, 206', accentLight: '#E5E7EB', accentGlow: '#C0C5CE', gradientStart: 'rgba(192, 197, 206,', textMuted: 'rgba(229, 231, 235, 0.6)' },
  white:   { accent: '#FFFFFF', accentRgb: '255, 255, 255', accentLight: '#F3F4F6', accentGlow: '#FFFFFF', gradientStart: 'rgba(255, 255, 255,', textMuted: 'rgba(243, 244, 246, 0.6)' },
  teal:    { accent: '#14B8A6', accentRgb: '20, 184, 166',  accentLight: '#99F6E4', accentGlow: '#14B8A6', gradientStart: 'rgba(20, 184, 166,',  textMuted: 'rgba(153, 246, 228, 0.6)' },
  lime:    { accent: '#A3E635', accentRgb: '163, 230, 53',  accentLight: '#D9F99D', accentGlow: '#A3E635', gradientStart: 'rgba(163, 230, 53,',  textMuted: 'rgba(217, 249, 157, 0.6)' },
  magenta: { accent: '#D946EF', accentRgb: '217, 70, 239',  accentLight: '#F0ABFC', accentGlow: '#D946EF', gradientStart: 'rgba(217, 70, 239,',  textMuted: 'rgba(240, 171, 252, 0.6)' },
  crimson: { accent: '#DC143C', accentRgb: '220, 20, 60',   accentLight: '#FCA5A5', accentGlow: '#DC143C', gradientStart: 'rgba(220, 20, 60,',   textMuted: 'rgba(252, 165, 165, 0.6)' },
  violet:  { accent: '#8B5CF6', accentRgb: '139, 92, 246',  accentLight: '#C4B5FD', accentGlow: '#8B5CF6', gradientStart: 'rgba(139, 92, 246,',  textMuted: 'rgba(196, 181, 253, 0.6)' },
  amber:   { accent: '#F59E0B', accentRgb: '245, 158, 11',  accentLight: '#FCD34D', accentGlow: '#F59E0B', gradientStart: 'rgba(245, 158, 11,',  textMuted: 'rgba(252, 211, 77, 0.6)' },
};

const THEME_STORAGE_KEY = 'tradeport_theme';
const GLASS_STORAGE_KEY = 'tradeport_glass_mode';
const FONT_STORAGE_KEY = 'tradeport_font';
const HERO_STORAGE_KEY = 'tradeport_hero_style';
const CASE_STORAGE_KEY = 'tradeport_text_case';
const BG_STORAGE_KEY = 'tradeport_bg_type';
const CARDBG_STORAGE_KEY = 'tradeport_card_bg';
const SHAPE_STORAGE_KEY = 'tradeport_card_shape';

export interface ThemeState {
  themeName: ThemeName; theme: ThemeColors; setThemeName: (name: ThemeName) => void;
  glassMode: GlassMode; setGlassMode: (mode: GlassMode) => void;
  fontFamily: FontFamily; fontFamilyCSS: string; setFontFamily: (f: FontFamily) => void;
  heroStyle: HeroStyle; setHeroStyle: (h: HeroStyle) => void;
  textCase: TextCase; textCaseCSS: string; setTextCase: (t: TextCase) => void;
  bgType: BgType; setBgType: (b: BgType) => void;
  cardBgMode: CardBgMode; setCardBgMode: (c: CardBgMode) => void;
  cardShape: CardShape; setCardShape: (s: CardShape) => void;
}

export const [ThemeProvider, useTheme] = createContextHook<ThemeState>(() => {
  const [themeName, setThemeNameState] = useState<ThemeName>('violet');
  const [glassMode, setGlassModeState] = useState<GlassMode>('commander');
  const [fontFamily, setFontFamilyState] = useState<FontFamily>('system');
  const [heroStyle, setHeroStyleState] = useState<HeroStyle>('circle');
  const [textCase, setTextCaseState] = useState<TextCase>('normal');
  const [bgType, setBgTypeState] = useState<BgType>('robot');
  const [cardBgMode, setCardBgModeState] = useState<CardBgMode>('thumbnail');
  const [cardShape, setCardShapeState] = useState<CardShape>('rounded');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((s) => { if (s && s in THEMES) setThemeNameState(s as ThemeName); }).catch(() => {});
    AsyncStorage.getItem(GLASS_STORAGE_KEY).then((s) => { if (s === 'neon' || s === 'minimal' || s === 'liquid' || s === 'commander' || s === 'mech') setGlassModeState(s); }).catch(() => {});
    AsyncStorage.getItem(FONT_STORAGE_KEY).then((s) => { if (s && s in FONT_MAP) setFontFamilyState(s as FontFamily); }).catch(() => {});
    AsyncStorage.getItem(HERO_STORAGE_KEY).then((s) => { if (s === 'square' || s === 'circle') setHeroStyleState(s); }).catch(() => {});
    AsyncStorage.getItem(CASE_STORAGE_KEY).then((s) => { if (s && s in TEXT_CASE_MAP) setTextCaseState(s as TextCase); }).catch(() => {});
    AsyncStorage.getItem(BG_STORAGE_KEY).then((s) => { if (s === 'robot' || s === 'video1' || s === 'video2' || s === 'video3' || s === 'video4' || s === 'custom' || s === 'off') setBgTypeState(s); }).catch(() => {});
    AsyncStorage.getItem(CARDBG_STORAGE_KEY).then((s) => { if (s === 'thumbnail' || s === 'fullcover') setCardBgModeState(s); }).catch(() => {});
    AsyncStorage.getItem(SHAPE_STORAGE_KEY).then((s) => { if (s === 'rounded' || s === 'pill' || s === 'superpill') setCardShapeState(s); }).catch(() => {});
  }, []);

  const setThemeName = useCallback((name: ThemeName) => { setThemeNameState(name); AsyncStorage.setItem(THEME_STORAGE_KEY, name).catch(() => {}); }, []);
  const setGlassMode = useCallback((mode: GlassMode) => { setGlassModeState(mode); AsyncStorage.setItem(GLASS_STORAGE_KEY, mode).catch(() => {}); }, []);
  const setFontFamily = useCallback((f: FontFamily) => { setFontFamilyState(f); AsyncStorage.setItem(FONT_STORAGE_KEY, f).catch(() => {}); }, []);
  const setHeroStyle = useCallback((h: HeroStyle) => { setHeroStyleState(h); AsyncStorage.setItem(HERO_STORAGE_KEY, h).catch(() => {}); }, []);
  const setTextCase = useCallback((t: TextCase) => { setTextCaseState(t); AsyncStorage.setItem(CASE_STORAGE_KEY, t).catch(() => {}); }, []);
  const setBgType = useCallback((b: BgType) => { setBgTypeState(b); AsyncStorage.setItem(BG_STORAGE_KEY, b).catch(() => {}); }, []);
  const setCardBgMode = useCallback((c: CardBgMode) => { setCardBgModeState(c); AsyncStorage.setItem(CARDBG_STORAGE_KEY, c).catch(() => {}); }, []);
  const setCardShape = useCallback((s: CardShape) => { setCardShapeState(s); AsyncStorage.setItem(SHAPE_STORAGE_KEY, s).catch(() => {}); }, []);

  const theme = THEMES[themeName];
  const fontFamilyCSS = FONT_MAP[fontFamily];
  const textCaseCSS = TEXT_CASE_MAP[textCase];

  return { themeName, theme, setThemeName, glassMode, setGlassMode, fontFamily, fontFamilyCSS, setFontFamily, heroStyle, setHeroStyle, textCase, textCaseCSS, setTextCase, bgType, setBgType, cardBgMode, setCardBgMode, cardShape, setCardShape };
});

export { THEMES, FONT_MAP, TEXT_CASE_MAP, GOOGLE_FONTS_URL };
