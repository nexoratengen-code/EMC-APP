import { startTestFlights, MAX_SYMBOLS_PER_ACCOUNT } from '@/app/api/mt5/testflight/engine';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({} as any));
    const id = body?.id as string;
    // `symbols` is the multi-select path; `symbol` is still accepted so an
    // older client build keeps working against a newer server.
    const raw: unknown = Array.isArray(body?.symbols) ? body.symbols : (body?.symbol ? [body.symbol] : []);
    // Broker symbols are case-sensitive with suffixes (XAUUSD.mic) — trim only.
    const symbols = (raw as unknown[])
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
      .slice(0, MAX_SYMBOLS_PER_ACCOUNT);
    const volume = Number(body?.volume);
    const count = Number(body?.count) || 1;
    const intervalMinutes = Number(body?.intervalMinutes) || 10;
    const comment = (body?.comment as string) || '';
    if (!id || symbols.length === 0 || !volume) {
      return Response.json({ error: 'id, at least one symbol and volume are required' }, { status: 400 });
    }
    const result = await startTestFlights({ id, symbols, volume, count, intervalMs: intervalMinutes * 60_000, comment });
    // Nothing started at all is a failure the caller must see, not a silent ok.
    if (!result.ok) {
      return Response.json({ error: result.rejected[0]?.error || 'Failed to start', ...result }, { status: 502 });
    }
    return Response.json(result);
  } catch (error: any) {
    console.error('MT5 testflight/start error:', error);
    return Response.json({ error: error?.message || 'Failed to start test flight' }, { status: 502 });
  }
}
