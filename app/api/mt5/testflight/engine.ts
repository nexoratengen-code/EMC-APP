// Server-side Test-Flight engine (SERVER ONLY).
// Runs the open -> hold -> close & reverse loop on the BACKEND so it keeps
// trading even when the iOS app is backgrounded or fully closed. State lives in
// this module (a cached singleton), keyed by the Api2Trade session UUID.
//
// NOTE: in-memory only — a server restart/redeploy clears active flights.
import { orderSend, orderClose } from '@/services/api2trade';

type Leg = 'Buy' | 'Sell';

interface Flight {
  symbol: string;
  volume: number;
  count: number;
  intervalMs: number;
  comment: string;
  dir: Leg;
  tickets: number[];
  timer: ReturnType<typeof setTimeout> | null;
  active: boolean;
  status: string;
  startedAt: number;
  nextReverseAt: number;
  legCount: number;
}

const flights = new Map<string, Flight>();
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

// Keep the Render free-tier service awake while a flight is running by pinging
// our own public URL (Render sleeps after ~15 min with no inbound traffic).
function ensureKeepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL;
  if (!url || keepAliveTimer) return;
  const base = url.replace(/\/$/, '');
  keepAliveTimer = setInterval(() => {
    fetch(`${base}/health`).catch(() => {});
  }, 5 * 60 * 1000);
  console.log('[TestFlight:srv] keep-alive started for', base);
}
function maybeStopKeepAlive() {
  if (flights.size === 0 && keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    console.log('[TestFlight:srv] keep-alive stopped (no active flights)');
  }
}

async function cycle(id: string): Promise<void> {
  const f = flights.get(id);
  if (!f || !f.active) return;

  // ── Open `count` positions in the current direction ──
  f.tickets = [];
  for (let i = 0; i < f.count; i++) {
    if (!f.active) return;
    try {
      const order: any = await orderSend({ id, symbol: f.symbol, operation: f.dir, volume: f.volume, comment: f.comment });
      if (order && typeof order.ticket === 'number' && order.ticket > 0) {
        f.tickets.push(order.ticket);
        console.log(`[TestFlight:srv] ${id} opened ${f.dir} ${f.symbol} ${i + 1}/${f.count} — ticket ${order.ticket}`);
      } else {
        console.warn(`[TestFlight:srv] ${id} open rejected:`, JSON.stringify(order));
        f.status = `Broker rejected ${f.dir} ${f.symbol}: ${order?.error || order?.message || 'no ticket'}`;
      }
    } catch (e: any) {
      console.error(`[TestFlight:srv] ${id} open error:`, e?.message || e);
    }
    f.dir = f.dir === 'Buy' ? 'Sell' : 'Buy'; // alternate direction on every trade
  }
  f.legCount += 1;
  if (f.tickets.length) {
    f.status = `${f.symbol} x${f.tickets.length} open (alternating Buy/Sell) — next round in ${Math.round(f.intervalMs / 60000)}m`;
  }
  f.nextReverseAt = Date.now() + f.intervalMs;
  if (!f.active) return;

  // ── Hold intervalMs, then close all and reverse ──
  f.timer = setTimeout(async () => {
    const ff = flights.get(id);
    if (!ff || !ff.active) return;
    const toClose = [...ff.tickets];
    ff.tickets = [];
    for (const t of toClose) {
      try {
        await orderClose({ id, ticket: t, lots: ff.volume });
        console.log(`[TestFlight:srv] ${id} closed ticket ${t}`);
      } catch (e: any) {
        console.error(`[TestFlight:srv] ${id} close error:`, e?.message || e);
      }
    }
    // Direction already alternates per-trade; keep the running sequence going.
    cycle(id);
  }, f.intervalMs);
}

export function startTestFlight(params: { id: string; symbol: string; volume: number; count: number; intervalMs: number; comment?: string }) {
  const { id } = params;
  // Replace any existing flight for this session (close its open legs first).
  stopTestFlight(id, true).catch(() => {});
  const f: Flight = {
    symbol: params.symbol,
    volume: params.volume || 0.01,
    count: Math.max(1, params.count || 1),
    intervalMs: Math.max(5000, params.intervalMs || 600000),
    comment: (params.comment || '').slice(0, 31), // MT5 comment max ~31 chars
    dir: Math.random() < 0.5 ? 'Buy' : 'Sell', // random first trade, then strict alternation
    tickets: [],
    timer: null,
    active: true,
    status: 'Starting…',
    startedAt: Date.now(),
    nextReverseAt: 0,
    legCount: 0,
  };
  flights.set(id, f);
  ensureKeepAlive();
  console.log(`[TestFlight:srv] START ${id} — ${f.symbol} x${f.count} @ ${f.volume}, every ${Math.round(f.intervalMs / 60000)}m`);
  cycle(id);
  return { ok: true, running: true };
}

export async function stopTestFlight(id: string, closeOpen = true) {
  const f = flights.get(id);
  if (!f) return { ok: true, wasRunning: false };
  f.active = false;
  if (f.timer) { clearTimeout(f.timer); f.timer = null; }
  if (closeOpen && f.tickets.length) {
    for (const t of f.tickets) {
      try { await orderClose({ id, ticket: t, lots: f.volume }); console.log(`[TestFlight:srv] ${id} closed ticket ${t} on stop`); }
      catch (e: any) { console.error(`[TestFlight:srv] ${id} stop-close error:`, e?.message || e); }
    }
  }
  flights.delete(id);
  maybeStopKeepAlive();
  console.log(`[TestFlight:srv] STOP ${id}`);
  return { ok: true, wasRunning: true };
}

export function getStatus(id: string) {
  const f = flights.get(id);
  if (!f || !f.active) return { running: false };
  return {
    running: true,
    symbol: f.symbol,
    volume: f.volume,
    count: f.count,
    dir: f.dir,
    openTickets: f.tickets.length,
    status: f.status,
    legCount: f.legCount,
    intervalMs: f.intervalMs,
    msToReverse: Math.max(0, f.nextReverseAt - Date.now()),
  };
}
