/**
 * Stop and target placement for the test-flight engine (SERVER ONLY).
 *
 * Distances come from the symbol's own recent range (ATR) rather than a fixed
 * number of points. A 200-point stop is a rounding error on XAUUSD and several
 * times the daily range on EURUSD, so one fixed setting across a multi-symbol
 * run would be wrong for nearly every symbol in it.
 *
 * Ported from TradePort's strategy engine, trimmed to what placement needs:
 * no trailing, no breakers, no signal logic.
 */
import { getPriceHistory, type Candle } from '@/services/api2trade';

export type Side = 'Buy' | 'Sell';

/** Bars pulled per sizing call. Enough for ATR(14) with room to spare. */
const TF_MINUTES = 15;
const ATR_PERIOD = 14;
const BARS = 60;

/**
 * Wilder's ATR. Returns the series; the caller wants the last value.
 * NaN until there are `period + 1` candles to work with — never guessed.
 */
export function atr(candles: Candle[], period: number): number[] {
  const out = new Array<number>(candles.length).fill(NaN);
  if (candles.length < period + 1) return out;

  const tr: number[] = [NaN];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].closePrice;
    tr.push(Math.max(
      c.highPrice - c.lowPrice,
      Math.abs(c.highPrice - prevClose),
      Math.abs(c.lowPrice - prevClose),
    ));
  }

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  out[period] = sum / period;
  for (let i = period + 1; i < candles.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

/**
 * Price decimals for a symbol, inferred from prices the broker actually sent.
 * Gold quotes 2, FX majors 5, indices 1-2. A stop carrying more precision than
 * the symbol allows gets rejected, so this is not cosmetic.
 */
export function decimalsOf(...prices: Array<number | null | undefined>): number {
  let max = 0;
  for (const p of prices) {
    if (p === null || p === undefined || !isFinite(p)) continue;
    const s = String(p);
    const dot = s.indexOf('.');
    if (dot >= 0) max = Math.max(max, s.length - dot - 1);
  }
  return Math.min(8, max);
}

export function round(price: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(price * f) / f;
}

/** Protective stop: `mult` x ATR the wrong side of entry. */
export function stopPrice(entry: number, atrValue: number, dir: Side, mult: number, decimals: number): number {
  const distance = atrValue * mult;
  return round(dir === 'Buy' ? entry - distance : entry + distance, decimals);
}

/** Target, or null when take-profit is disabled (mult <= 0). */
export function targetPrice(entry: number, atrValue: number, dir: Side, mult: number, decimals: number): number | null {
  if (!mult || mult <= 0) return null;
  const distance = atrValue * mult;
  return round(dir === 'Buy' ? entry + distance : entry - distance, decimals);
}

export interface Sizing {
  atr: number;
  price: number;
  decimals: number;
}

/**
 * Current ATR and reference price for a symbol, or null when they cannot be
 * established.
 *
 * Null means "do not open". The caller must not substitute a guess: an
 * unprotected position is precisely what this module exists to prevent.
 */
export async function sizingFor(id: string, symbol: string): Promise<Sizing | null> {
  try {
    // Overshoot the window: the broker clock may lead ours, and thin symbols
    // have gaps, so ask for far more time than BARS strictly needs.
    const to = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const from = new Date(Date.now() - TF_MINUTES * (BARS + 30) * 4 * 60 * 1000);
    const raw = await getPriceHistory(id, symbol, TF_MINUTES, from, to);
    if (!Array.isArray(raw) || raw.length < ATR_PERIOD + 2) return null;

    // Drop the forming bar — its range is incomplete and would understate ATR.
    const candles = raw.slice(0, -1);
    const series = atr(candles, ATR_PERIOD);
    const value = series[series.length - 1];
    if (!Number.isFinite(value) || value <= 0) return null;

    const last = candles[candles.length - 1];
    const price = last?.closePrice ?? 0;
    if (!(price > 0)) return null;

    return {
      atr: value,
      price,
      decimals: decimalsOf(last?.closePrice, last?.openPrice, last?.highPrice),
    };
  } catch (e: any) {
    console.error(`[TestFlight:srv] ${id} sizing error on ${symbol}:`, e?.message || e);
    return null;
  }
}
