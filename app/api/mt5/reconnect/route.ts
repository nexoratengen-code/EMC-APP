import { ensureConnected, disconnect } from '@/services/api2trade';
import { isAllowedServer, SERVER_NOT_ALLOWED_TEXT } from '@/services/broker-allow';

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
    // An account linked to another broker before Razor only: close its session and refuse.
    if (!isAllowedServer(server)) {
      await disconnect(id).catch(() => {});
      console.warn('MT5 reconnect refused, server not allowed:', { server, login });
      return Response.json({ error: SERVER_NOT_ALLOWED_TEXT, code: 'SERVER_NOT_ALLOWED' }, { status: 403 });
    }
    const r = await ensureConnected(id, server, login, password);
    return Response.json({ uuid: id, reconnected: r.reconnected });
  } catch (error: any) {
    console.error('MT5 reconnect error:', error);
    return Response.json({ error: error?.message || 'Reconnect failed' }, { status: 502 });
  }
}
