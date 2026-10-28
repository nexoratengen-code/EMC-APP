// Api2Trade REST API wrapper (server-side only)
// Docs: https://docs.api2trade.com/docs
// All endpoints use GET with query parameters
//
// SECURITY: This module is SERVER-ONLY. Never import it from client code.
// Credentials are read from process.env and never returned to the client.

const API2TRADE_BASE = (process.env.API2TRADE_BASE_URL || 'https://mt5.mt4api.dev').replace(/\/$/, '');
const API2TRADE_KEY = process.env.API2TRADE_API_KEY || '';
const API2TRADE_USER = process.env.API2TRADE_USERNAME || '';
const API2TRADE_PASS = process.env.API2TRADE_PASSWORD || '';

const TIMEOUT_MS = 30000;

function getAuthHeaders(): Record<string, string> {
  if (API2TRADE_USER && API2TRADE_PASS) {
    const encoded = Buffer.from(`${API2TRADE_USER}:${API2TRADE_PASS}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }
  if (API2TRADE_KEY) {
    return { 'x-api-key': API2TRADE_KEY };
  }
  throw new Error('Api2Trade credentials not configured');
}

// ── Session handles ─────────────────────────────────────────
//
// The app and the robots know an account by the uuid it was first connected
// under. Api2Trade can kill the session behind that uuid for good (27 Oct 2026,
// 22:30 SAST, TradePort: every uuid answered 503 "upstream connect error ...
// connection refused" and re-auth under the same uuid failed the same way,
// while EA Converter, which opens a FRESH session when the old one is dead,
// kept trading). So a handle can point at a newer Api2Trade session: every
// call made with the handle goes to the session it maps to. In memory only:
// after a restart the app's reconnect on open maps it again. Ported from
// TradePort #35, 28 Oct 2026.
const liveSession = new Map<string, string>();

/** The Api2Trade session to use for a handle (the handle itself unless it was moved). */
export function sessionFor(id: string): string {
  return liveSession.get(id) ?? id;
}

async function api2tradeGet<T = any>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const url = new URL(`${API2TRADE_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, k === 'id' ? sessionFor(String(v)) : String(v));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { ...getAuthHeaders(), Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Api2Trade ${res.status}: ${body || res.statusText}`);
    }

    return await res.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Account Management ─────────────────────────────────────

export interface RegisterAccountResult {
  message: string;
  id: string;
}

export async function registerAccount(
  type: 'Metatrader 4' | 'Metatrader 5',
  server: string,
  user: string,
  password: string,
  name?: string,
): Promise<RegisterAccountResult> {
  return api2tradeGet<RegisterAccountResult>('RegisterAccount', {
    type,
    server,
    user,
    password,
    name: name || '',
  });
}

export interface ConnectExResult {
  message?: string;
  user?: number;
  [key: string]: unknown;
}

export async function connectEx(
  id: string,
  server: string,
  user: string,
  password: string,
): Promise<ConnectExResult> {
  return api2tradeGet<ConnectExResult>('ConnectEx', { id, server, user, password });
}

export async function disconnect(id: string): Promise<{ message: string }> {
  try {
    return await api2tradeGet('Disconnect', { id });
  } finally {
    liveSession.delete(id);
  }
}

export async function checkConnect(id: string): Promise<any> {
  return api2tradeGet('CheckConnect', { id });
}

// ── Account Info ────────────────────────────────────────────

export interface AccountSummary {
  balance: number;
  credit: number;
  profit: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number;
  currency: string;
}

export async function getAccountSummary(id: string): Promise<AccountSummary> {
  return api2tradeGet<AccountSummary>('AccountSummary', { id });
}

// Verify the session behind `id` is live and, if not, silently re-establish it
// from stored credentials: first under the session it already uses, and when
// that session is dead for good, under a FRESH Api2Trade session that `id` then
// points at (see liveSession above). The account-summary probe IS the real
// source of truth (a live session returns leverage > 0). The handle never
// changes, so the app's stored uuid and the robots keyed by it need no rewiring.
const inFlight = new Map<string, Promise<{ reconnected: boolean }>>();

async function summaryLeverage(id: string): Promise<number> {
  try {
    const summary = await getAccountSummary(id);
    return Number(summary?.leverage) || 0;
  } catch {
    return 0;
  }
}

async function reestablish(
  id: string,
  server: string,
  user: string,
  password: string,
): Promise<{ reconnected: boolean }> {
  if (await summaryLeverage(id)) return { reconnected: false };

  // Re-auth under the session it already uses. Tolerate ConnectEx throwing
  // (e.g. "already connected"); the summary re-check is the gate.
  await connectEx(id, server, user, password).catch(() => {});
  if (await summaryLeverage(id)) return { reconnected: true };

  // That session is gone for good: open a new one and point the handle at it.
  const dead = sessionFor(id);
  const fresh = crypto.randomUUID();
  await connectEx(fresh, server, user, password).catch(() => {});
  if (!(await summaryLeverage(fresh))) {
    await disconnect(fresh).catch(() => {});
    throw new Error('Reconnect failed');
  }
  liveSession.set(id, fresh);
  if (dead !== id) await disconnect(dead).catch(() => {});
  return { reconnected: true };
}

export async function ensureConnected(
  id: string,
  server: string,
  user: string,
  password: string,
): Promise<{ reconnected: boolean }> {
  // One account can be checked by a robot and the app at once; they share one
  // attempt so a dead session is replaced once, not once each.
  const running = inFlight.get(id);
  if (running) return running;
  const attempt = reestablish(id, server, user, password).finally(() => inFlight.delete(id));
  inFlight.set(id, attempt);
  return attempt;
}

export interface AccountDetails {
  serverName: string;
  user: number;
  host: string;
  port: number;
  company: string;
  currency: string;
  accountName: string;
  accountLeverage: number;
}

export async function getAccountDetails(id: string): Promise<AccountDetails> {
  return api2tradeGet<AccountDetails>('AccountDetails', { id });
}

export interface AccountInfo {
  login: number;
  type: string;
  userName: string;
  country: string;
  balance: number;
  credit: number;
  leverage: number;
  email: string;
}

export async function getAccountInfo(id: string): Promise<AccountInfo> {
  return api2tradeGet<AccountInfo>('Account', { id });
}

// ── Orders ──────────────────────────────────────────────────

export interface Order {
  ticket: number;
  profit: number;
  swap: number;
  commission: number;
  openPrice: number;
  openTime: string;
  closePrice: number;
  closeTime: string;
  lots: number;
  orderType: string;
  symbol: string;
  comment: string;
  stopLoss: number;
  takeProfit: number;
}

export async function getOpenOrders(id: string): Promise<Order[]> {
  return api2tradeGet<Order[]>('OpenedOrders', { id });
}

export async function getClosedOrders(id: string): Promise<Order[]> {
  return api2tradeGet<Order[]>('ClosedOrders', { id });
}

export async function getOpenOrder(id: string, ticket: number): Promise<Order> {
  return api2tradeGet<Order>('OpenedOrder', { id, ticket });
}

// ── Trading ─────────────────────────────────────────────────

export type Operation = 'Buy' | 'Sell' | 'BuyLimit' | 'SellLimit' | 'BuyStop' | 'SellStop';

export interface TradeParams {
  id: string;
  symbol: string;
  operation: Operation;
  volume: number;
  price?: number;
  slippage?: number;
  stoploss?: number;
  takeprofit?: number;
  comment?: string;
  expertID?: number;
}

export async function orderSend(params: TradeParams): Promise<Order> {
  return api2tradeGet<Order>('OrderSend', params as any);
}

export interface ModifyParams {
  id: string;
  ticket: number;
  stoploss: number;
  takeprofit: number;
  price?: number;
}

export async function orderModify(params: ModifyParams): Promise<Order> {
  return api2tradeGet<Order>('OrderModify', params as any);
}

export interface CloseParams {
  id: string;
  ticket: number;
  lots?: number;
  price?: number;
  slippage?: number;
}

export async function orderClose(params: CloseParams): Promise<Order> {
  return api2tradeGet<Order>('OrderClose', params as any);
}

// Broker symbol parameters (min/step/max lot, digits, …). Field names vary by
// gateway build, so callers read defensively.
export async function getSymbolParams(id: string, symbol: string): Promise<any> {
  return api2tradeGet<any>('SymbolParams', { id, symbol });
}

// ── Market Data ─────────────────────────────────────────────

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  time: string;
  last: number;
  volume: number;
}

export async function getQuote(id: string, symbol: string): Promise<Quote> {
  return api2tradeGet<Quote>('GetQuote', { id, symbol });
}

export interface Candle {
  time: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  tickVolume?: number;
  spread?: number;
  volume?: number;
}

/**
 * Candles for a symbol. Used to size stops from the symbol's own volatility
 * rather than a fixed distance, which would be far too wide on EURUSD and far
 * too tight on XAUUSD.
 */
export async function getPriceHistory(
  id: string,
  symbol: string,
  timeframeMinutes: number,
  from: Date,
  to: Date,
): Promise<Candle[]> {
  const iso = (d: Date) => d.toISOString().slice(0, 19);
  return api2tradeGet<Candle[]>('PriceHistory', {
    id,
    symbol,
    timeframe: Math.max(1, Math.round(timeframeMinutes)),
    from: iso(from),
    to: iso(to),
  });
}

export async function getQuoteMany(id: string, symbols: string[]): Promise<Quote[]> {
  const url = new URL(`${API2TRADE_BASE}/GetQuoteMany`);
  url.searchParams.set('id', sessionFor(id));
  for (const s of symbols) url.searchParams.append('symbols', s);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { ...getAuthHeaders(), Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Api2Trade ${res.status}`);
    return await res.json() as Quote[];
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSymbolList(id: string): Promise<string[]> {
  return api2tradeGet<string[]>('SymbolList', { id });
}

export interface MarketWatch {
  symbol: string;
  high: number;
  low: number;
  openPrice: number;
  closePrice: number;
  dailyChange: number;
  bid: number;
  ask: number;
  spread: number;
  volume: number;
}

export async function getMarketWatch(id: string, symbols: string[]): Promise<MarketWatch[]> {
  const url = new URL(`${API2TRADE_BASE}/MarketWatchMany`);
  url.searchParams.set('id', sessionFor(id));
  for (const s of symbols) url.searchParams.append('symbols', s);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { ...getAuthHeaders(), Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Api2Trade ${res.status}`);
    return await res.json() as MarketWatch[];
  } finally {
    clearTimeout(timeout);
  }
}
