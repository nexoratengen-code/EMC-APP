import { Platform } from 'react-native';

// Use server API instead of direct database connection
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://eamobileconnect.com/admin').replace(/\/$/, '');

export interface DatabaseSignal {
  id: string;
  ea: string;
  asset: string;
  latestupdate: string;
  type: string;
  action: string;
  price: string;
  tp: string;
  sl: string;
  time: string;
  results: string;
}

export interface LicenseData {
  id: string;
  owner: string;
  ea: string;
  user: string;
  k_ey: string;
  created: string;
  expires: string;
  plan: string;
  status: string;
  phone_secret_code: string;
  phoneId: string;
  power: string;
}

export interface SignalPollingCallback {
  onSignalFound: (signal: DatabaseSignal) => void;
  onError: (error: string) => void;
}

class DatabaseSignalsPollingService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onSignalFound?: (signal: DatabaseSignal) => void;
  private onError?: (error: string) => void;
  private currentLicenseKey: string | null = null;
  private currentEA: string | null = null;
  private lastPollTime: string | null = null;
  private processedSignalIds: Set<string> = new Set();

  // Service is always enabled (uses server API)
  enableDatabaseConnections() {
    console.log('Signals polling service enabled (using server API)');
  }

  // Service is always enabled (uses server API)
  disableDatabaseConnections() {
    this.stopPolling();
    console.log('Signals polling service disabled');
  }

  // Start polling for signals using EMC phone_secret
  startPolling(
    phoneSecret: string,
    onSignalFound?: (signal: DatabaseSignal) => void,
    onError?: (error: string) => void
  ) {
    if (this.intervalId) {
      console.log('Database signals polling already running');
      return;
    }

    this.onSignalFound = onSignalFound;
    this.onError = onError;
    this.currentLicenseKey = phoneSecret; // stored for reference
    this.lastPollTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    this.processedSignalIds.clear();

    console.log('Starting signals polling with phone_secret');

    this.startRealPolling(phoneSecret);
  }

  // Stop polling
  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.currentLicenseKey = null;
    this.currentEA = null;
    this.lastPollTime = null;
    this.processedSignalIds.clear();
    console.log('Database signals polling stopped');
  }


  // Real EMC signals polling
  private startRealPolling(phoneSecret: string) {
    console.log('Starting EMC signals polling');

    // Immediate first poll
    this.checkForNewSignals(phoneSecret).catch(err => {
      console.error('Error on initial signal poll:', err);
    });

    // Then check every 2 seconds (matches EMC Android behaviour)
    this.intervalId = setInterval(async () => {
      try {
        await this.checkForNewSignals(phoneSecret);
      } catch (error) {
        console.error('Error checking for EMC signals:', error);
        if (this.onError) {
          this.onError(`Signals error: ${error}`);
        }
      }
    }, 2000);
  }

  // Check for new signals via EMC /admin/api/signals/?phone_secret=
  private async checkForNewSignals(phoneSecret: string) {
    try {
      const apiUrl = `${API_BASE_URL}/api/signals/?phone_secret=${encodeURIComponent(phoneSecret)}`;

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      const body = await response.json();

      // EMC returns: { message: "accept"|"error", data: {id,asset,action,price,tp,sl,time,latestupdate} | null }
      if (body?.message !== 'accept' || !body?.data) {
        return;
      }

      const s = body.data;
      const signal: DatabaseSignal = {
        id: String(s.id),
        ea: '',
        asset: s.asset,
        latestupdate: s.latestupdate,
        type: '',
        action: s.action,
        price: s.price,
        tp: s.tp,
        sl: s.sl,
        time: s.time,
        results: ''
      };

      // DEDUP
      const signalKey = `${signal.id}_${signal.latestupdate}`;
      if (this.processedSignalIds.has(signalKey)) return;
      this.processedSignalIds.add(signalKey);

      console.log('✅ NEW EMC signal:', signal.asset, signal.action, 'id:', signal.id);
      if (this.onSignalFound) this.onSignalFound(signal);

      // Trim the processed set
      if (this.processedSignalIds.size > 200) {
        const arr = Array.from(this.processedSignalIds);
        this.processedSignalIds = new Set(arr.slice(-100));
      }

      this.lastPollTime = new Date().toISOString();
    } catch (error) {
      console.error('Error in checkForNewSignals:', error);
      throw error;
    }
  }

  // Check if polling is running
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  // Get current polling status
  getStatus() {
    return {
      isRunning: this.isRunning(),
      licenseKey: this.currentLicenseKey,
      ea: this.currentEA,
      lastPollTime: this.lastPollTime,
      isEnabled: true // Always enabled (uses server API)
    };
  }
}

export const databaseSignalsPollingService = new DatabaseSignalsPollingService();
export default databaseSignalsPollingService;
