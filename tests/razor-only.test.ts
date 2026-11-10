import { test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';

// Razor only (10 Nov 2026): connect refuses any other broker before Api2Trade;
// reconnect closes a session on another broker and refuses it.
process.env.API2TRADE_BASE_URL = 'https://api2trade.test';
process.env.API2TRADE_API_KEY = 'test-key';

let connectPOST: (req: Request) => Promise<Response>;
let reconnectPOST: (req: Request) => Promise<Response>;
let ensureConnected: (id: string, s: string, l: string, p: string) => Promise<{ reconnected: boolean }>;
let calls: string[] = [];
const realFetch = globalThis.fetch;

beforeAll(async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url.pathname.slice(1));
    const body = url.pathname === '/AccountSummary' ? { leverage: 500 } : { message: 'ok' };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  ({ POST: connectPOST } = await import('../app/api/mt5/connect/route'));
  ({ POST: reconnectPOST } = await import('../app/api/mt5/reconnect/route'));
  ({ ensureConnected } = await import('../services/api2trade'));
});
afterAll(() => { globalThis.fetch = realFetch; });
beforeEach(() => { calls = []; });

const post = (fn: (r: Request) => Promise<Response>, path: string, body: object) =>
  fn(new Request(`http://localhost${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

test('connect: another broker gets 403 and never reaches Api2Trade', async () => {
  const res = await post(connectPOST, '/api/mt5/connect', { server: 'Exness-MT5Real8', login: '1', password: 'pw-123456' });
  expect(res.status).toBe(403);
  expect((await res.json()).code).toBe('SERVER_NOT_ALLOWED');
  expect(calls.length).toBe(0);
});

test('connect: Razor goes through, any case', async () => {
  const res = await post(connectPOST, '/api/mt5/connect', { server: ' razormarkets-live', login: '1', password: 'pw-123456' });
  expect(res.status).toBe(200);
  expect(calls).toEqual(['ConnectEx', 'AccountSummary']);
});

test('reconnect: another broker is disconnected and refused', async () => {
  const res = await post(reconnectPOST, '/api/mt5/reconnect', { id: 'u-1', server: 'Exness-MT5Real8', login: '1', password: 'pw-123456' });
  expect(res.status).toBe(403);
  expect(calls).toEqual(['Disconnect']);
});

test('reconnect: Razor as before', async () => {
  const res = await post(reconnectPOST, '/api/mt5/reconnect', { id: 'u-2', server: 'RazorMarkets-Live', login: '1', password: 'pw-123456' });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ uuid: 'u-2', reconnected: false });
});

test('ensureConnected refuses another broker without calling Api2Trade', async () => {
  await expect(ensureConnected('u-3', 'Exness-MT5Real8', '1', 'p')).rejects.toThrow('Razor Markets accounts only');
  expect(calls.length).toBe(0);
});
