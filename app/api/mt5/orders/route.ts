import { getOpenOrders, getClosedOrders } from '@/services/api2trade';

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ error: 'Account UUID required' }, { status: 400 });

    const type = url.searchParams.get('type') || 'open';

    if (type === 'closed') {
      const orders = await getClosedOrders(id);
      return Response.json(orders);
    }

    if (type === 'all') {
      const [open, closed] = await Promise.all([
        getOpenOrders(id),
        getClosedOrders(id),
      ]);
      return Response.json({ open, closed });
    }

    const orders = await getOpenOrders(id);
    return Response.json(orders);
  } catch (error) {
    console.error('MT5 orders error:', error);
    return Response.json({ error: 'Failed to fetch orders' }, { status: 502 });
  }
}
