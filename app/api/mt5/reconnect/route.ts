import { ensureConnected } from '@/services/api2trade';

// Verify + silently re-establish the MT5 session behind `id`, reusing the same
// UUID so nothing downstream (open orders, batches) has to be rewired.
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({} as any));
    const id = body?.id as string;
    const server = body?.server as string;
    const login = body?.login as string;
    const password = body?.password as string;
    if (!id || !server || !login || !password) {
      return Response.json({ error: 'id, server, login and password are required' }, { status: 400 });
    }
    const r = await ensureConnected(id, server, login, password);
    return Response.json({ uuid: id, reconnected: r.reconnected });
  } catch (error: any) {
    console.error('MT5 reconnect error:', error);
    return Response.json({ error: error?.message || 'Reconnect failed' }, { status: 502 });
  }
}
