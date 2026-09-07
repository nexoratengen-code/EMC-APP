// Server-side Test-Flight engine (SERVER ONLY) — hardened for 24/7 operation.
//
// Design:
//  • Time-anchored: each flight stores `nextActionAt`; a single master tick (every
//    15s) fires due actions. No fragile per-flight setTimeout.
//  • Multi-symbol: an account can fly several symbols at once, each its own
//    flight with its own direction, tickets and clock, so EURUSD rotating does
//    not disturb XAUUSD.
//  • Flat-proof: a rotation only opens the opposite side once the symbol is
//    PROVEN empty. "I could not find out" is never treated as flat.
//  • Protected: every order carries an ATR-sized stop from the moment it is
//    sent. No sizing means no trade.
//  • DB-persisted: every state change is saved to MySQL, so a server
//    restart/redeploy/crash doesn't lose the flight.
//  • Resume-on-boot: resumeFlights() reloads active flights and the master tick
//    continues them — catching up a single rotation if it was down for a while.
//  • Keep-alive: self-pings RENDER_EXTERNAL_URL/health to reduce free-tier sleep
//    (an EXTERNAL uptime pinger is still the dependable anti-sleep on free tier).
import { orderSend, orderClose, getOpenOrders, getSymbolParams } from '@/services/api2trade';
import { getPool } from '@/app/api/_db';
import { sizingFor, stopPrice, targetPrice, type Sizing } from './protection';

type Leg = 'Buy' | 'Sell';
type Phase = 'opening' | 'holding';

interface Flight {
  symbol: string;
  volume: number;
  count: number;
  intervalMs: number;
  comment: string;
  dir: Leg;
  phase: Phase;
  nextActionAt: number;
  tickets: number[];
  active: boolean;
  status: string;
  startedAt: number;
  legCount: number;
  busy: boolean;
  /** Stop distance, x ATR. Every order carries one. */
  slAtrMult: number;
  /** Target distance, x ATR. 0 disables the target. */
  tpAtrMult: number;
}

/**
 * account id → symbol → flight.
 *
 * Two levels rather than a flat `id::symbol` key so an account's flights can be
 * enumerated cheaply — persist, stop-all and the status endpoint all need
 * exactly that.
 */
const flights = new Map<string, Map<string, Flight>>();

/** Hard ceiling per account. Each symbol holds its own clock and open tickets. */
export const MAX_SYMBOLS_PER_ACCOUNT = 20;

let masterTimer: ReturnType<typeof setInterval> | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let tableReady = false;

// DB persistence + resume only run in production (Render). Otherwise a local dev
// server sharing the same MySQL would resume — and TRADE — live production
// flights. Opt in locally with TESTFLIGHT_PERSIST=1 (and your own DB) if needed.
const PERSIST_ENABLED = process.env.RENDER === 'true' || process.env.TESTFLIGHT_PERSIST === '1';

// ── Flight lookup ──
function legsOf(id: string): Map<string, Flight> {
  let m = flights.get(id);
  if (!m) { m = new Map(); flights.set(id, m); }
  return m;
}

function liveFlights(id: string): Flight[] {
  return [...(flights.get(id)?.values() ?? [])].filter((f) => f.active);
}

function anyFlightActive(): boolean {
  for (const m of flights.values()) for (const f of m.values()) if (f.active) return true;
  return false;
}

/** Every (account, symbol) pair the master tick should visit. */
function allPairs(): { id: string; symbol: string }[] {
  const out: { id: string; symbol: string }[] = [];
  for (const [id, legs] of flights) for (const symbol of legs.keys()) out.push({ id, symbol });
  return out;
}

// ── Persistence (MySQL; best-effort — engine still runs in-memory if DB is down) ──
//
// The row stays keyed by uuid and the symbol list lives inside the JSON blob,
// so this needs no migration on the existing emc_testflights table.
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  const pool = await getPool();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS emc_testflights (
      uuid VARCHAR(80) PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  );
  tableReady = true;
}

function snapshot(f: Flight) {
  return {
    symbol: f.symbol, volume: f.volume, count: f.count, intervalMs: f.intervalMs,
    comment: f.comment, dir: f.dir, phase: f.phase, nextActionAt: f.nextActionAt,
    tickets: f.tickets, legCount: f.legCount, startedAt: f.startedAt,
    slAtrMult: f.slAtrMult, tpAtrMult: f.tpAtrMult,
  };
}

/** Writes every live flight for the account as one row. */
function persist(id: string): void {
  if (!PERSIST_ENABLED) return;
  (async () => {
    try {
      const live = liveFlights(id);
      await ensureTable();
      const pool = await getPool();
      if (live.length === 0) {
        await pool.query('DELETE FROM emc_testflights WHERE uuid = ?', [id]);
        return;
      }
      await pool.query(
        'INSERT INTO emc_testflights (uuid, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)',
        [id, JSON.stringify({ v: 2, flights: live.map(snapshot) })],
      );
    } catch (e: any) { console.error('[TestFlight:srv] persist error:', e?.message || e); }
  })();
}

function unpersist(id: string): void {
  if (!PERSIST_ENABLED) return;
  (async () => {
    try { await ensureTable(); const pool = await getPool(); await pool.query('DELETE FROM emc_testflights WHERE uuid = ?', [id]); }
    catch (e: any) { console.error('[TestFlight:srv] unpersist error:', e?.message || e); }
  })();
}

// ── Keep-alive (reduce free-tier sleep; external pinger still recommended) ──
function ensureKeepAlive(): void {
  const url = process.env.RENDER_EXTERNAL_URL;
  if (!url || keepAliveTimer) return;
  const base = url.replace(/\/$/, '');
  keepAliveTimer = setInterval(() => { fetch(`${base}/health`).catch(() => {}); }, 4 * 60 * 1000);
  console.log('[TestFlight:srv] keep-alive started for', base);
}

function maybeStopTimers(): void {
  if (anyFlightActive()) return;
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  if (masterTimer) { clearInterval(masterTimer); masterTimer = null; }
}

// ── Flat verification ───────────────────────────────────────────────────────
//
// A rotation is only hedge-free if "the symbol is flat" is a PROVEN fact before
// the opposite side opens. Every read below is fail-CLOSED: an account that
// cannot be read is never treated as flat, because opening on an unknown is
// exactly how Buy and Sell end up live at once.
//
// The old close emptied f.tickets before the close resolved and swallowed
// failures, then flipped and reopened immediately — so a close that failed left
// a live position nothing was tracking, and the next batch opened straight on
// top of it.
type FlatCheck = 'FLAT' | 'STILL_OPEN' | 'UNKNOWN';

const FLAT_PASSES = 4;      // confirm passes after a close
const SETTLE_MS = 1500;     // broker needs a beat; backs off per pass
const RETRY_MS = 60_000;    // hold and retry when we can't prove flat
const POLL_MS = 20_000;     // how often we look to see if the account went flat

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * EVERY position on the account, or null when it cannot be read.
 *
 * Account-wide on purpose. Nothing new opens while anything at all is still
 * open: our own trades, another symbol's, or ones the user placed by hand.
 */
async function accountPositions(id: string): Promise<any[] | null> {
  try {
    const open = await getOpenOrders(id);
    if (!Array.isArray(open)) return null; // unparseable — unknown, NOT empty
    return open.filter((o: any) => o?.ticket);
  } catch (e: any) {
    console.error(`[TestFlight:srv] ${id} accountPositions error:`, e?.message || e);
    return null;
  }
}

/** Positions open on this symbol, or null when the account can't be read. */
async function openPositions(id: string, symbol: string): Promise<any[] | null> {
  try {
    const open = await getOpenOrders(id);
    if (!Array.isArray(open)) return null; // unparseable — unknown, NOT flat
    return open.filter((o: any) => o?.symbol === symbol && o?.ticket);
  } catch (e: any) {
    console.error(`[TestFlight:srv] ${id} openPositions error:`, e?.message || e);
    return null;
  }
}

// ── Trading primitives (all concurrent) ──

/**
 * Open `count` orders, each carrying its own stop and target.
 *
 * The levels ride on the OrderSend itself rather than a follow-up modify. A
 * modify leaves a window where the position is live and unprotected, and one
 * that fails leaves it that way indefinitely.
 */
async function openBatch(id: string, f: Flight, sizing: Sizing): Promise<void> {
  const dir = f.dir;
  const sl = stopPrice(sizing.price, sizing.atr, dir, f.slAtrMult, sizing.decimals);
  const tp = targetPrice(sizing.price, sizing.atr, dir, f.tpAtrMult, sizing.decimals);

  const results: any[] = await Promise.all(
    Array.from({ length: f.count }, () =>
      orderSend({
        id, symbol: f.symbol, operation: dir, volume: f.volume, comment: f.comment,
        stoploss: sl,
        ...(tp !== null ? { takeprofit: tp } : {}),
      }).catch((e: any) => {
        console.error(`[TestFlight:srv] ${id} ${f.symbol} open error:`, e?.message || e);
        return null;
      }),
    ),
  );

  let lost = 0;
  for (const o of results) {
    if (o && typeof o.ticket === 'number' && o.ticket > 0) f.tickets.push(o.ticket);
    else if (o) f.status = `Broker rejected ${dir} ${f.symbol}: ${o?.error || o?.message || 'no ticket'}`;
    else lost += 1; // threw/timed out — the order may still have filled
  }

  // A send that threw can still be live at the broker. Adopt anything on the
  // symbol we don't already know about, or it becomes an invisible position the
  // next rotation hedges against.
  if (lost > 0) {
    const live = await openPositions(id, f.symbol);
    if (live) {
      const adopted = live.filter((o: any) => !f.tickets.includes(o.ticket)).map((o: any) => o.ticket);
      if (adopted.length) {
        f.tickets.push(...adopted);
        console.warn(`[TestFlight:srv] ${id} adopted ${adopted.length} untracked ticket(s) after ${lost} failed send(s)`);
      }
    } else {
      f.status = `${lost} send(s) failed and the account could not be re-read — positions may be untracked`;
    }
  }

  console.log(`[TestFlight:srv] ${id} opened ${f.tickets.length}/${f.count} ${dir} ${f.symbol} @ stop ${sl}${tp !== null ? `, target ${tp}` : ''}`);
}

/** Close the tickets we hold. Failures STAY in f.tickets so they're retried. */
async function closeBatch(id: string, f: Flight): Promise<void> {
  const toClose = [...f.tickets];
  if (!toClose.length) return;
  const results = await Promise.all(toClose.map((t) =>
    orderClose({ id, ticket: t, lots: f.volume })
      .then(() => { console.log(`[TestFlight:srv] ${id} closed ticket ${t}`); return { t, ok: true }; })
      .catch((e: any) => { console.error(`[TestFlight:srv] ${id} close error:`, e?.message || e); return { t, ok: false }; }),
  ));
  f.tickets = results.filter((r) => !r.ok).map((r) => r.t);
}

/**
 * Close everything on the symbol and PROVE it went flat.
 * UNKNOWN means the account could not be read — the caller must treat that as
 * "do not open", not as flat.
 */
async function closeUntilFlat(id: string, f: Flight): Promise<FlatCheck> {
  await closeBatch(id, f);

  let unreadable = false;
  for (let pass = 1; pass <= FLAT_PASSES; pass++) {
    await sleep(SETTLE_MS * pass); // 1.5s, 3s, 4.5s, 6s
    const open = await openPositions(id, f.symbol);

    if (open === null) { unreadable = true; continue; }
    unreadable = false;

    if (open.length === 0) { f.tickets = []; return 'FLAT'; }

    console.warn(`[TestFlight:srv] ${id} still ${open.length} open on ${f.symbol} (pass ${pass}) — re-closing`);
    f.tickets = open.map((o: any) => o.ticket); // remember them, never drop
    await Promise.all(open.map((o: any) =>
      orderClose({ id, ticket: o.ticket, lots: o.lots ?? f.volume }).catch(() => {}),
    ));
  }

  return unreadable ? 'UNKNOWN' : 'STILL_OPEN';
}

// Lift the volume to the broker's minimum lot for this symbol so orders aren't
// rejected as "invalid volume" (many .mic/cent symbols have a min above 0.01).
async function ensureMinLot(id: string, f: Flight): Promise<void> {
  try {
    const p: any = await getSymbolParams(id, f.symbol);
    const min = Number(
      p?.volumeMin ?? p?.volume_min ?? p?.minVolume ?? p?.lotMin ?? p?.minLot ?? p?.tradeVolumeMin,
    );
    if (Number.isFinite(min) && min > 0 && f.volume < min) {
      console.log(`[TestFlight:srv] ${id} volume ${f.volume} below broker min ${min} — lifting to ${min}`);
      f.volume = min;
      persist(id);
    }
  } catch (e: any) { console.error(`[TestFlight:srv] ${id} ensureMinLot error:`, e?.message || e); }
}

// ── Master tick: fire due actions for every flight ──
async function tickFlight(id: string, symbol: string): Promise<void> {
  const f = flights.get(id)?.get(symbol);
  if (!f || !f.active || f.busy) return;
  if (Date.now() < f.nextActionAt) return;
  f.busy = true;
  try {
    // Nothing is ever closed to make room. A trade ends exactly three ways:
    // its take profit, its stop loss, or the user. Until the account is
    // completely empty nothing new is placed — not the other direction, not
    // another symbol, nothing. That is what stops a losing position being
    // buried under a second one.
    //
    // So this is a poll: empty account, place a batch; anything open, wait and
    // look again. `intervalMs` no longer times a rotation, because there is no
    // forced rotation left to time.
    const open = await accountPositions(id);
    if (flights.get(id)?.get(symbol) !== f || !f.active) return;

    // Fail closed: an account we cannot read is not an empty one.
    if (open === null) {
      f.status = `Cannot read the account — waiting, retry in ${POLL_MS / 1000}s`;
      f.nextActionAt = Date.now() + POLL_MS;
      return;
    }

    if (open.length > 0) {
      // Track whichever of them are ours, so the status and a later stop are honest.
      f.tickets = open.filter((o: any) => o?.symbol === f.symbol).map((o: any) => o.ticket);
      const mine = f.tickets.length;
      const theirs = open.length - mine;
      f.status = theirs > 0
        ? `Waiting — ${open.length} trade(s) still open (${theirs} on other symbols or opened by you)`
        : `Holding ${mine} ${f.symbol} trade(s) — waiting for TP, SL or you to close them`;
      f.nextActionAt = Date.now() + POLL_MS;
      persist(id);
      return;
    }

    // Account is empty. Every order must carry a stop, so no sizing means no
    // trade — the same fail-closed rule.
    const sizing = await sizingFor(id, f.symbol);
    if (flights.get(id)?.get(symbol) !== f || !f.active) return;
    if (!sizing) {
      f.status = `No price data to size a stop on ${f.symbol} — nothing opened, retry in ${RETRY_MS / 1000}s`;
      console.error(`[TestFlight:srv] ${id} ${symbol} ABORTED — cannot size a stop, nothing opened`);
      f.nextActionAt = Date.now() + RETRY_MS;
      persist(id);
      return;
    }

    // Alternate the side each time a fresh batch goes on.
    if (f.legCount > 0) f.dir = f.dir === 'Buy' ? 'Sell' : 'Buy';

    await openBatch(id, f, sizing);
    if (flights.get(id)?.get(symbol) !== f || !f.active) return;

    f.phase = 'holding';
    f.legCount += 1;
    f.nextActionAt = Date.now() + POLL_MS;
    f.status = `${f.dir} ${f.symbol} x${f.tickets.length} — runs until TP, SL or you close it`;
    persist(id);
  } catch (e: any) {
    console.error(`[TestFlight:srv] ${id} ${symbol} tick error:`, e?.message || e);
  } finally {
    f.busy = false;
  }
}

function ensureMaster(): void {
  if (masterTimer) return;
  masterTimer = setInterval(() => {
    for (const p of allPairs()) tickFlight(p.id, p.symbol).catch(() => {});
  }, 15 * 1000);
  console.log('[TestFlight:srv] master tick started');
}

// ── Public API ──

/**
 * Start (or restart) one symbol for an account. Symbols already flying on the
 * same account keep going untouched.
 */
export async function startTestFlight(params: {
  id: string; symbol: string; volume: number; count: number; intervalMs: number; comment?: string;
  /** Stop distance x ATR. Defaults to 1.5. Set to 0 only if you mean it. */
  slAtrMult?: number;
  /** Target distance x ATR. Defaults to 3.0, i.e. twice the stop. 0 disables. */
  tpAtrMult?: number;
}) {
  const { id, symbol } = params;

  // Only the same symbol is replaced. Restarting EURUSD must not close XAUUSD.
  //
  // AWAITED. Fire-and-forget let the stop finish AFTER the new flight was
  // registered, and stopSymbol unregisters an account's map once it empties
  // (`flights.delete(id)`). The new flight was then sitting in an orphaned
  // Map: start answered "ok" while status, stop and resume all saw nothing.
  // That is the "I pressed start and nothing happened" report.
  if (flights.get(id)?.has(symbol)) {
    try {
      await stopSymbol(id, symbol, true);
    } catch (e: any) {
      console.error(`[TestFlight:srv] ${id} ${symbol} restart could not stop cleanly:`, e?.message || e);
      return { ok: false, running: false, error: 'Could not stop the previous run for this symbol' };
    }
  } else if (liveFlights(id).length >= MAX_SYMBOLS_PER_ACCOUNT) {
    return { ok: false, running: false, error: `At most ${MAX_SYMBOLS_PER_ACCOUNT} symbols can fly at once` };
  }

  // Re-acquired AFTER the stop, never before it. legsOf re-registers the map
  // if the stop removed it.
  const legs = legsOf(id);

  const f: Flight = {
    symbol,
    volume: params.volume || 0.01,
    count: Math.max(1, params.count || 1),
    intervalMs: Math.max(5000, params.intervalMs || 600000),
    comment: (params.comment || '').slice(0, 31),
    dir: Math.random() < 0.5 ? 'Buy' : 'Sell', // random first batch; flips each rotate
    phase: 'opening',
    nextActionAt: Date.now(),
    tickets: [],
    active: true,
    status: 'Starting…',
    startedAt: Date.now(),
    legCount: 0,
    busy: false,
    slAtrMult: params.slAtrMult ?? 1.5,
    // A target at twice the stop distance. The flight still rotates on its own
    // clock, so whichever comes first ends the leg.
    tpAtrMult: params.tpAtrMult ?? 3.0,
  };
  legs.set(symbol, f);

  // Prove the flight is reachable through `flights`, not merely through the
  // local reference. Answering "ok" for a flight nothing can see is a lie the
  // trader acts on.
  if (flights.get(id)?.get(symbol) !== f) {
    console.error(`[TestFlight:srv] ${id} ${symbol} START FAILED — flight was not registered`);
    return { ok: false, running: false, error: 'Could not register the run. Please try again.' };
  }
  persist(id);
  ensureKeepAlive();
  ensureMaster();
  console.log(`[TestFlight:srv] START ${id} — ${f.symbol} x${f.count} @ ${f.volume}, every ${Math.round(f.intervalMs / 60000)}m`);
  // Deliberately clears NOTHING. If the account already holds trades — yours
  // or otherwise — the first pass simply waits for them to close.
  (async () => {
    await ensureMinLot(id, f);
    if (flights.get(id)?.get(symbol) === f && f.active) await tickFlight(id, symbol);
  })();
  return { ok: true, running: true, symbol };
}

/** Start several symbols at once. Partial failure is reported, not thrown. */
export async function startTestFlights(params: {
  id: string; symbols: string[]; volume: number; count: number; intervalMs: number; comment?: string;
  slAtrMult?: number; tpAtrMult?: number;
}) {
  const seen = new Set<string>();
  const started: string[] = [];
  const rejected: { symbol: string; error: string }[] = [];
  for (const raw of params.symbols) {
    // Broker symbols are case-sensitive with suffixes (XAUUSD.mic) — never
    // normalise the casing here.
    const symbol = (raw || '').trim();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    const r = await startTestFlight({ ...params, symbol });
    if (r.ok) started.push(symbol);
    else rejected.push({ symbol, error: r.error || 'Failed to start' });
  }
  return { ok: started.length > 0, running: started.length > 0, started, rejected };
}

/** Stop one symbol, sweeping it flat. Used when restarting it too. */
export async function stopSymbol(id: string, symbol: string, closeOpen = true) {
  const f = flights.get(id)?.get(symbol);
  if (!f) return { ok: true, wasRunning: false, symbol, flat: true, flatCheck: 'FLAT' as FlatCheck };
  f.active = false;

  let leftOpen: FlatCheck = 'FLAT';
  if (closeOpen) {
    // Sweep the symbol, not just our ticket list — a send whose response was
    // lost leaves a position STOP would otherwise walk away from.
    leftOpen = await closeUntilFlat(id, f);
    if (leftOpen !== 'FLAT') {
      console.error(`[TestFlight:srv] ${id} STOP could not confirm ${symbol} flat (${leftOpen}) — ${f.tickets.length} ticket(s) may still be open`);
    }
  }

  const legs = flights.get(id);
  // Only delete if it is still the same flight — a restart may have replaced it.
  if (legs?.get(symbol) === f) legs.delete(symbol);
  if (legs && legs.size === 0) flights.delete(id);
  console.log(`[TestFlight:srv] STOP ${id} ${symbol}`);
  return { ok: true, wasRunning: true, symbol, flat: leftOpen === 'FLAT', flatCheck: leftOpen };
}

/**
 * Stop everything flying on an account. One press of STOP ends every symbol.
 *
 * `flat` is only true when EVERY symbol was proven empty — "all closed" is a
 * claim the user acts on, so it must not be guessed.
 */
export async function stopTestFlight(id: string, closeOpen = true) {
  const legs = flights.get(id);
  if (!legs || legs.size === 0) {
    unpersist(id); maybeStopTimers();
    return { ok: true, wasRunning: false, stopped: [] as string[], flat: true, notFlat: [] as string[] };
  }
  const symbols = [...legs.keys()];
  const results = await Promise.all(symbols.map(async (s) => {
    try { return await stopSymbol(id, s, closeOpen); }
    catch { return { symbol: s, flat: false, flatCheck: 'UNKNOWN' as FlatCheck }; }
  }));
  flights.delete(id);
  unpersist(id);
  maybeStopTimers();
  const notFlat = results.filter((r) => !r.flat).map((r) => r.symbol);
  console.log(`[TestFlight:srv] STOP ${id} (${symbols.length} symbol${symbols.length === 1 ? '' : 's'})${notFlat.length ? `, NOT flat: ${notFlat.join(', ')}` : ''}`);
  return { ok: true, wasRunning: true, stopped: symbols, flat: notFlat.length === 0, notFlat };
}

export function getStatus(id: string) {
  const live = liveFlights(id);
  if (live.length === 0) return { running: false, symbols: [] as any[] };
  const now = Date.now();
  return {
    running: true,
    count: live.length,
    symbols: live.map((f) => ({
      symbol: f.symbol,
      volume: f.volume,
      count: f.count,
      dir: f.dir,
      phase: f.phase,
      openTickets: f.tickets.length,
      status: f.status,
      legCount: f.legCount,
      intervalMs: f.intervalMs,
      slAtrMult: f.slAtrMult,
      tpAtrMult: f.tpAtrMult,
      msToReverse: Math.max(0, f.nextActionAt - now),
    })),
  };
}

// ── Resume on boot ──
export async function resumeFlights(): Promise<void> {
  if (!PERSIST_ENABLED) { console.log('[TestFlight:srv] resume disabled (not production) — skipping'); return; }
  try {
    await ensureTable();
    const pool = await getPool();
    const [rows]: any = await pool.query('SELECT uuid, data FROM emc_testflights');
    if (!Array.isArray(rows) || rows.length === 0) return;
    for (const row of rows) {
      const id = row.uuid;
      let parsed: any;
      try { parsed = JSON.parse(row.data); } catch { continue; }
      // v2 rows hold a list; rows written before multi-symbol hold a single
      // flight object, so accept both rather than abandoning live positions.
      const list: any[] = Array.isArray(parsed?.flights) ? parsed.flights : (parsed?.symbol ? [parsed] : []);
      const legs = legsOf(id);
      for (const c of list) {
        if (!c?.symbol || legs.has(c.symbol)) continue;
        const f: Flight = {
          symbol: c.symbol,
          volume: c.volume || 0.01,
          count: Math.max(1, c.count || 1),
          intervalMs: Math.max(5000, c.intervalMs || 600000),
          comment: c.comment || '',
          dir: c.dir === 'Sell' ? 'Sell' : 'Buy',
          phase: c.phase === 'opening' ? 'opening' : 'holding',
          nextActionAt: Number(c.nextActionAt) || Date.now(),
          tickets: Array.isArray(c.tickets) ? c.tickets : [],
          active: true,
          status: 'Resumed',
          startedAt: Number(c.startedAt) || Date.now(),
          legCount: Number(c.legCount) || 0,
          busy: false,
          // Rows written before stops existed carry neither, so fall back to
          // the same defaults a fresh flight would get.
          slAtrMult: Number.isFinite(c.slAtrMult) ? c.slAtrMult : 1.5,
          tpAtrMult: Number.isFinite(c.tpAtrMult) ? c.tpAtrMult : 3.0,
        };
        legs.set(f.symbol, f);
        console.log(`[TestFlight:srv] RESUME ${id} — ${f.symbol} x${f.count} every ${Math.round(f.intervalMs / 60000)}m (phase ${f.phase}, due in ${Math.round((f.nextActionAt - Date.now()) / 1000)}s)`);
      }
      if (legs.size === 0) flights.delete(id);
    }
    if (anyFlightActive()) { ensureKeepAlive(); ensureMaster(); }
  } catch (e: any) {
    console.error('[TestFlight:srv] resumeFlights error:', e?.message || e);
  }
}
