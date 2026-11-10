/**
 * The MT5 servers this app links to. Razor Markets only (owner's call, 10 Nov 2026).
 *
 * Checked on the server at connect and reconnect, and inside ensureConnected,
 * so a request sent around the app's screen cannot link another broker, and an
 * account already linked to another broker is cut off at its next reconnect.
 * Matching ignores case and surrounding spaces; anything else must be exact.
 */
export const ALLOWED_MT5_SERVERS: readonly string[] = ['RazorMarkets-Live'];

export const SERVER_NOT_ALLOWED_TEXT =
  'This app works with Razor Markets accounts only. Use server RazorMarkets-Live.';

export function isAllowedServer(server: unknown): boolean {
  if (typeof server !== 'string') return false;
  const s = server.trim().toLowerCase();
  return ALLOWED_MT5_SERVERS.some((a) => a.toLowerCase() === s);
}
