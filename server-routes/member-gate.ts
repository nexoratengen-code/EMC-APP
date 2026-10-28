/**
 * The lock on the robot API (/api/mt5/* and /api/news/schedule), 28 Oct 2026.
 *
 * Until now none of those routes asked who was calling, so anyone with the
 * app's address could connect an MT5 account, read balances and place trades
 * on EMC's Api2Trade account without paying. TradePort closed the same hole on
 * 17 Oct. Every /api/mt5/* request now carries the member session the app gets
 * at sign-in (admin/api/auth/member/ on eamobileconnect.com):
 *
 *   Authorization: Bearer <session>
 *   X-EMC-Email: <email>
 *
 * EMC's website is the only place that knows whether that session is still the
 * member's current one and still paid (admin/api/auth/session/), so this asks
 * it. The robot screens poll every few seconds, so each answer is remembered
 * per session for CACHE_MS. If the website cannot answer at all, a session it
 * confirmed within STALE_OK_MS keeps working, so a short outage on that side
 * never stops a paying member; a session it has never confirmed is refused with
 * a "try again". Account verdicts (signed in elsewhere, unpaid, not found) are
 * refused at once.
 */

const AUTH_BASE = (process.env.EMC_AUTH_BASE_URL || 'https://eamobileconnect.com/admin').replace(/\/$/, '');
const CACHE_MS = 5 * 60 * 1000;
const STALE_OK_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;

type Verdict = { ok: boolean; reason: string; at: number };
const verdicts = new Map<string, Verdict>();

function refuse(status: number, reason: string): Response {
  const error = status === 401
    ? 'Please sign in again.'
    : status === 503
      ? 'We could not confirm your access just now. Please try again in a moment.'
      : 'Your access is not active.';
  return Response.json({ error, reason }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function credentials(request: Request): { email: string; session: string } | null {
  const auth = request.headers.get('authorization') || '';
  const session = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const email = (request.headers.get('x-emc-email') || '').normalize('NFKC').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(session) || !email.includes('@')) return null;
  return { email, session };
}

/** EMC's verdict, or null when the website did not answer. */
async function askEmc(email: string, session: string): Promise<{ ok: boolean; reason: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${AUTH_BASE}/api/auth/session/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, session }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data?.ok === true) return { ok: true, reason: '' };
    if (data?.ok === false && typeof data.reason === 'string') return { ok: false, reason: data.reason };
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** null = let the request through; a Response = refuse with it. */
export async function memberGate(request: Request): Promise<Response | null> {
  if (request.method === 'OPTIONS') return null;
  const creds = credentials(request);
  if (!creds) return refuse(401, 'sign_in_required');

  const key = `${creds.email}|${creds.session}`;
  const now = Date.now();
  const hit = verdicts.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.ok ? null : refuse(hit.reason === 'no_session' ? 401 : 403, hit.reason);

  const answer = await askEmc(creds.email, creds.session);
  if (!answer) {
    if (hit?.ok && now - hit.at < STALE_OK_MS) return null;
    return refuse(503, 'auth_unavailable');
  }

  verdicts.set(key, { ...answer, at: now });
  if (verdicts.size > 5000) {
    for (const [k, v] of verdicts) if (now - v.at > STALE_OK_MS) verdicts.delete(k);
  }
  if (answer.ok) return null;
  return refuse(answer.reason === 'no_session' ? 401 : 403, answer.reason);
}
