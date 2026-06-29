const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://eamobileconnect.com/admin').replace(/\/$/, '');

export interface AuthBody {
  email: string;
  password?: string;
  mentor?: string;
}

export interface Account {
  id: string;
  email: string;
  status: string;
  paid: boolean;
  used: boolean;
  invalidMentor?: number;
}

export interface App {
  message: string;
  version: number;
}

export interface Signals {
  signals: Signal[];
}

export interface Signal {
  id: string;
  asset: string;
  action: string;
  price: string;
  tp: string;
  sl: string;
  time: string;
  latestupdate: string;
}

export interface SignalsResponse {
  message: 'accept' | 'error';
  data?: Signal;
}

export interface SignalsListResponse {
  message: 'accept' | 'error';
  data?: Signal[];
}

export interface Symbol {
  id: string;
  name: string;
}

export interface SymbolsResponse {
  message: 'accept' | 'error';
  data?: Symbol[];
}

export interface LicenseAuthBody {
  licence: string;
  phone_secret?: string;
}

export interface Owner {
  name: string;
  email: string;
  phone: string;
  logo: string;
}

export interface LicenseData {
  user: string;
  status: string;
  expires: string;
  key: string;
  phone_secret_key: string;
  ea_name: string;
  ea_notification: string;
  owner: Owner;
}

export interface LicenseAuthResponse {
  message: 'accept' | 'used' | 'error';
  data?: LicenseData;
}

// MT5 (Api2Trade) calls go to the BUN SERVER, not the external PHP backend.
// BASE_URL above points at https://eamobileconnect.com/admin (PHP) and MUST NOT
// be used for the /api/mt5/* routes. The Bun server hosts /api/mt5-proxy,
// /api/mt5/*, /mqtt, etc. and is same-origin with the web build. This mirrors
// the resolution used in services/mqtt-signals.ts.
const SERVER_BASE = (() => {
  // Explicit override (useful for native/dev builds where same-origin is N/A).
  const envBase = process.env.EXPO_PUBLIC_SERVER_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, '');
  // Web: the app is served from the Bun server, so use same-origin.
  if (typeof window !== 'undefined' && window.location?.host) {
    return `${window.location.protocol}//${window.location.host}`;
  }
  // Fallback (server-side render / native dev): local Bun server.
  return 'http://localhost:3000';
})();

export interface MT5ConnectBody {
  server: string;
  login: string;
  password: string;
  name?: string;
}

class ApiService {
  /**
   * Base URL of the BUN SERVER (NOT the PHP BASE_URL). Used for all /api/mt5/*
   * Api2Trade routes. Resolved from EXPO_PUBLIC_SERVER_BASE_URL, else same-origin
   * on web, else http://localhost:3000.
   */
  private getServerBase(): string {
    return SERVER_BASE;
  }

  async authenticate(authBody: AuthBody): Promise<Account> {
    if (!authBody?.email) throw new Error('Email is required');
    // EMC endpoint: GET /api/auth/app/?email=...&use=0|1
    // Returns: { message: "accept" | "used" | "admin" | "none", version: number }
    const email = authBody.email.trim().toLowerCase();
    const endpoint = `${BASE_URL}/api/auth/app/?email=${encodeURIComponent(email)}`;
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
    } catch (networkError) {
      const hint = BASE_URL
        ? ''
        : ' Set EXPO_PUBLIC_API_BASE_URL to your API host for native builds.';
      throw new Error(`Network error contacting auth service.${hint}`);
    }
    let data: { message?: string; version?: number } = {};
    try {
      data = (await res.json()) as { message?: string; version?: number };
    } catch (e) {
      throw new Error('Authentication failed');
    }

    const msg = (data?.message || '').toString();
    // EMC message values: "accept" (paid+unused) | "used" (paid+used) | "admin" | "none"
    const found = msg === 'accept' || msg === 'used' || msg === 'admin';
    const paid = msg === 'accept' || msg === 'used' || msg === 'admin';
    const used = msg === 'used';

    return {
      id: authBody.email,
      email: authBody.email,
      status: found ? 'ok' : 'not_found',
      paid,
      used,
      invalidMentor: 0, // EMC has no mentor concept
    };
  }

  async lockEmail(email: string): Promise<void> {
    if (!email) return;
    const cleaned = email.trim().toLowerCase();
    const endpoint = `${BASE_URL}/api/auth/app/?email=${encodeURIComponent(cleaned)}&use=1`;
    try {
      await fetch(endpoint, { method: 'GET', headers: { 'Accept': 'application/json' } });
    } catch (e) {
      console.warn('lockEmail failed (non-fatal):', e);
    }
  }

  async getSignals(phoneSecret: string): Promise<SignalsResponse> {
    if (!phoneSecret) return { message: 'error' };
    try {
      const res = await fetch(`${BASE_URL}/api/signals/?phone_secret=${encodeURIComponent(phoneSecret)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      const data = (await res.json()) as SignalsResponse;
      return data;
    } catch {
      return { message: 'error' };
    }
  }

  async getApp(email: string, use: boolean = false): Promise<App> {
    // Mock: pretend app is available for any email
    void use;
    if (!email) {
      return { message: 'none', version: 1 } as unknown as App;
    }
    return { message: 'accept', version: 1 } as unknown as App;
  }

  async getSymbols(phoneSecret: string): Promise<SymbolsResponse> {
    if (!phoneSecret) return { message: 'error' };
    const res = await fetch(`${BASE_URL}/api/symbols/?phone_secret=${encodeURIComponent(phoneSecret)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    try {
      const data = (await res.json()) as SymbolsResponse;
      return data;
    } catch {
      return { message: 'error' };
    }
  }

  async authenticateLicense(licenseBody: LicenseAuthBody): Promise<LicenseAuthResponse> {
    if (!licenseBody?.licence) return { message: 'error' };
    // EMC endpoint: POST /api/auth/ with body { licence, phone_secret? }
    const endpoint = `${BASE_URL}/api/auth/`;

    // Add timeout to avoid hanging forever on network issues
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(licenseBody),
        signal: controller.signal,
      });
    } catch (networkError) {
      clearTimeout(timeout);
      const hint = BASE_URL ? '' : ' Set EXPO_PUBLIC_API_BASE_URL to your API host for native builds.';
      console.error('License auth network error:', networkError);
      return { message: 'error' };
    }
    clearTimeout(timeout);

    try {
      const data = (await res.json()) as LicenseAuthResponse;
      return data;
    } catch {
      return { message: 'error' };
    }
  }

  // ── Api2Trade MT5 Integration ──
  // Proxied through our own Bun server (getServerBase()) so the Api2Trade
  // credentials stay server-side. NEVER uses the PHP BASE_URL. The client only
  // ever holds the session UUID — the MT5 password is never returned here.

  async connectMT5(params: MT5ConnectBody): Promise<{ uuid: string }> {
    const { server, login, password, name } = params;
    const endpoint = `${this.getServerBase()}/api/mt5/connect`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server, login, password, name }),
    });
    let data: any = {};
    try {
      data = await res.json();
    } catch {
      // fall through to status-based error below
    }
    if (!res.ok) {
      if (res.status === 401) throw new Error(data?.error || 'Invalid MT5 credentials');
      throw new Error(data?.error || 'MT5 connection failed');
    }
    return data;
  }

  async disconnectMT5(uuid: string): Promise<{ message: string }> {
    const endpoint = `${this.getServerBase()}/api/mt5/connect?id=${encodeURIComponent(uuid)}`;
    const res = await fetch(endpoint, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to disconnect');
    return data;
  }

  async getMT5AccountSummary(uuid: string): Promise<any> {
    const endpoint = `${this.getServerBase()}/api/mt5/account?id=${encodeURIComponent(uuid)}`;
    const res = await fetch(endpoint);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch account');
    return data;
  }

  async getMT5Orders(uuid: string, type: 'open' | 'closed' | 'all' = 'open'): Promise<any> {
    const endpoint = `${this.getServerBase()}/api/mt5/orders?id=${encodeURIComponent(uuid)}&type=${type}`;
    const res = await fetch(endpoint);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch orders');
    return data;
  }

  async sendMT5Trade(params: {
    id: string;
    action: 'open' | 'modify' | 'close';
    symbol?: string;
    operation?: string;
    volume?: number;
    ticket?: number;
    stoploss?: number;
    takeprofit?: number;
    price?: number;
    slippage?: number;
    comment?: string;
    lots?: number;
  }): Promise<any> {
    const endpoint = `${this.getServerBase()}/api/mt5/trade`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Trade failed');
    return data;
  }

  async getMT5Symbols(uuid: string): Promise<string[]> {
    const endpoint = `${this.getServerBase()}/api/mt5/symbols?id=${encodeURIComponent(uuid)}&action=list`;
    const res = await fetch(endpoint);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch symbols');
    return data;
  }

  async getMT5Quote(uuid: string, symbol: string): Promise<any> {
    const endpoint = `${this.getServerBase()}/api/mt5/symbols?id=${encodeURIComponent(uuid)}&action=quote&symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(endpoint);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch quote');
    return data;
  }

  async getMT5MarketWatch(uuid: string, symbols: string[]): Promise<any[]> {
    const params = new URLSearchParams({ id: uuid, action: 'watch' });
    for (const s of symbols) params.append('symbols', s);
    const endpoint = `${this.getServerBase()}/api/mt5/symbols?${params.toString()}`;
    const res = await fetch(endpoint);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch market watch');
    return data;
  }

  // ── Server-side Test Flight (runs even when the app is closed) ──
  async startTestFlight(uuid: string, opts: { symbol: string; volume: number; count: number; intervalMinutes: number }): Promise<any> {
    const res = await fetch(`${this.getServerBase()}/api/mt5/testflight/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: uuid, ...opts }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to start test flight');
    return data;
  }

  async stopTestFlight(uuid: string): Promise<any> {
    const res = await fetch(`${this.getServerBase()}/api/mt5/testflight/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: uuid }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to stop test flight');
    return data;
  }

  async getTestFlightStatus(uuid: string): Promise<any> {
    const res = await fetch(`${this.getServerBase()}/api/mt5/testflight/status?id=${encodeURIComponent(uuid)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to get test flight status');
    return data;
  }
}

export const apiService = new ApiService();
export default apiService;