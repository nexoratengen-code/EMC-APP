// Server-side Test-Flight engine (SERVER ONLY) — hardened for 24/7 operation.
//
// Design:
//  • Time-anchored: each flight stores `nextActionAt`; a single master tick (every
//    15s) fires due actions. No fragile per-flight setTimeout.
//  • DB-persisted: every state change is saved to MySQL, so a server
//    restart/redeploy/crash doesn't lose the flight.
//  • Resume-on-boot: resumeFlights() reloads active flights and the master tick
//    continues them — catching up a single rotation if it was down for a while.
//  • Keep-alive: self-pings RENDER_EXTERNAL_URL/health to reduce free-tier sleep
//    (an EXTERNAL uptime pinger is still the dependable anti-sleep on free tier).
import { orderSend, orderClose, getOpenOrders } from '@/services/api2trade';
import { getPool } from '@/app/api/_db';

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
}

const flights = new Map<string, Flight>();
let masterTimer: ReturnType<typeof setInterval> | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let tableReady = false;

// ── Persistence (MySQL; best-effort — engine still runs in-memory if DB is down) ──
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

function persist(id: string, f: Flight): void {
  (async () => {
    try {
      await ensureTable();
      const pool = await getPool();
      const data = JSON.stringify({
        symbol: f.symbol, volume: f.volume, count: f.count, intervalMs: f.intervalMs,
        comment: f.comment, dir: f.dir, phase: f.phase, nextActionAt: f.nextActionAt,
        tickets: f.tickets, legCount: f.legCount, startedAt: f.startedAt,
      });
      await pool.query(
        'INSERT INTO emc_testflights (uuid, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)',
        [id, data],
      );
    } catch (e: any) { console.error('[TestFlight:srv] persist error:', e?.message || e); }
  })();
}

function unpersist(id: string): void {
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
  const anyActive = [...flights.values()].some((f) => f.active);
  if (anyActive) return;
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  if (masterTimer) { clearInterval(masterTimer); masterTimer = null; }
}

// ── Trading primitives (all concurrent) ──
async function openBatch(id: string, f: Flight): Promise<void> {
  const dir = f.dir;
  const results: any[] = await Promise.all(
    Array.from({ length: f.count }, () =>
      orderSend({ id, symbol: f.symbol, operation: dir, volume: f.volume, comment: f.comment })
        .catch((e: any) => { console.error(`[TestFlight:srv] ${id} open error:`, e?.message || e); return null; }),
    ),
  );
  f.tickets = [];
  for (const order of results) {
    if (order && typeof order.ticket === 'number' && order.ticket > 0) f.tickets.push(order.ticket);
    else if (order) f.status = `Broker rejected ${dir} ${f.symbol}: ${order?.error || order?.message || 'no ticket'}`;
  }
  console.log(`[TestFlight:srv] ${id} opened ${f.tickets.length}/${f.count} ${dir} ${f.symbol}`);
}

async function closeBatch(id: string, f: Flight): Promise<void> {
  const toClose = [...f.tickets];
  f.tickets = [];
  await Promise.all(toClose.map((t) =>
    orderClose({ id, ticket: t, lots: f.volume })
      .then(() => console.log(`[TestFlight:srv] ${id} closed ticket ${t}`))
      .catch((e: any) => console.error(`[TestFlight:srv] ${id} close error:`, e?.message || e)),
  ));
}

// Close any positions already open on this symbol so a flight starts flat.
async function cleanSymbol(id: string, symbol: string): Promise<void> {
  try {
    const open = await getOpenOrders(id);
    if (!Array.isArray(open)) return;
    const mine = open.filter((o: any) => o?.symbol === symbol && o?.ticket);
    if (mine.length === 0) return;
    console.log(`[TestFlight:srv] ${id} clearing ${mine.length} leftover ${symbol} position(s)`);
    await Promise.all(mine.map((o: any) =>
      orderClose({ id, ticket: o.ticket, lots: o.lots }).catch(() => {}),
    ));
  } catch (e: any) { console.error(`[TestFlight:srv] ${id} cleanSymbol error:`, e?.message || e); }
}

// ── Master tick: fire due actions for every flight ──
async function tickFlight(id: string): Promise<void> {
  const f = flights.get(id);
  if (!f || !f.active || f.busy) return;
  if (Date.now() < f.nextActionAt) return;
  f.busy = true;
  try {
    if (f.phase === 'opening') {
      await openBatch(id, f);
      f.phase = 'holding';
    } else {
      // holding → close current batch, flip side, open the next batch (no hedge,
      // never the same side twice in a row).
      await closeBatch(id, f);
      f.dir = f.dir === 'Buy' ? 'Sell' : 'Buy';
      await openBatch(id, f);
    }
    f.legCount += 1;
    f.nextActionAt = Date.now() + f.intervalMs;
    f.status = `${f.symbol} x${f.tickets.length} ${f.dir} open — next rotate in ${Math.round(f.intervalMs / 60000)}m`;
    persist(id, f);
  } catch (e: any) {
    console.error(`[TestFlight:srv] ${id} tick error:`, e?.message || e);
  } finally {
    f.busy = false;
  }
}

function ensureMaster(): void {
  if (masterTimer) return;
  masterTimer = setInterval(() => {
    for (const id of [...flights.keys()]) tickFlight(id).catch(() => {});
  }, 15 * 1000);
  console.log('[TestFlight:srv] master tick started');
}

// ── Public API ──
export function startTestFlight(params: { id: string; symbol: string; volume: number; count: number; intervalMs: number; comment?: string }) {
  const { id } = params;
  stopTestFlight(id, true).catch(() => {});
  const f: Flight = {
    symbol: params.symbol,
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
  };
  flights.set(id, f);
  persist(id, f);
  ensureKeepAlive();
  ensureMaster();
  console.log(`[TestFlight:srv] START ${id} — ${f.symbol} x${f.count} @ ${f.volume}, every ${Math.round(f.intervalMs / 60000)}m`);
  // Clear leftovers, then fire the first batch immediately (don't wait for the tick).
  (async () => {
    await cleanSymbol(id, f.symbol);
    if (flights.get(id) === f && f.active) await tickFlight(id);
  })();
  return { ok: true, running: true };
}

export async function stopTestFlight(id: string, closeOpen = true) {
  const f = flights.get(id);
  if (!f) { unpersist(id); return { ok: true, wasRunning: false }; }
  f.active = false;
  if (closeOpen && f.tickets.length) {
    await Promise.all(f.tickets.map((t) =>
      orderClose({ id, ticket: t, lots: f.volume })
        .then(() => console.log(`[TestFlight:srv] ${id} closed ticket ${t} on stop`))
        .catch((e: any) => console.error(`[TestFlight:srv] ${id} stop-close error:`, e?.message || e)),
    ));
  }
  flights.delete(id);
  unpersist(id);
  maybeStopTimers();
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
    msToReverse: Math.max(0, f.nextActionAt - Date.now()),
  };
}

// ── Resume on boot ──
export async function resumeFlights(): Promise<void> {
  try {
    await ensureTable();
    const pool = await getPool();
    const [rows]: any = await pool.query('SELECT uuid, data FROM emc_testflights');
    if (!Array.isArray(rows) || rows.length === 0) return;
    for (const row of rows) {
      const id = row.uuid;
      if (flights.has(id)) continue;
      let c: any;
      try { c = JSON.parse(row.data); } catch { continue; }
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
      };
      flights.set(id, f);
      console.log(`[TestFlight:srv] RESUME ${id} — ${f.symbol} x${f.count} every ${Math.round(f.intervalMs / 60000)}m (phase ${f.phase}, due in ${Math.round((f.nextActionAt - Date.now()) / 1000)}s)`);
    }
    if (flights.size > 0) { ensureKeepAlive(); ensureMaster(); }
  } catch (e: any) {
    console.error('[TestFlight:srv] resumeFlights error:', e?.message || e);
  }
}
