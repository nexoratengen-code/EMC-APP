import { DatabaseSignal } from './database-signals-polling';

// Connect via the server's WebSocket proxy (/mqtt) which forwards to the
// MQTT broker. This avoids mixed-content blocks on HTTPS deploys.
// On web: same-origin /mqtt path. On native: use EXPO_PUBLIC_API_BASE_URL.
const BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const MQTT_WS_URL = BASE
  ? BASE.replace(/^http/, 'ws') + '/mqtt'
  : `${typeof window !== 'undefined' ? (window.location.protocol === 'https:' ? 'wss:' : 'ws:') : 'ws:'}//${typeof window !== 'undefined' ? window.location.host : 'localhost:3000'}/mqtt`;

export interface MqttSignalCallback {
  onSignalFound: (signal: DatabaseSignal) => void;
  onError: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

class MqttSignalsService {
  private ws: WebSocket | null = null;
  private isRunning = false;
  private callbacks: MqttSignalCallback | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private subscribedTopics: string[] = [];
  private lastSeenId: string | null = null;

  start(symbols: string[], callbacks: MqttSignalCallback) {
    if (this.isRunning) return;

    this.callbacks = callbacks;
    this.subscribedTopics = symbols.length > 0
      ? symbols.map(s => `signals/${s}`)
      : ['signals/all'];
    this.isRunning = true;
    this.lastSeenId = null;

    console.log('[MQTT] Starting — connecting to', MQTT_WS_URL);
    this.connect();
  }

  stop() {
    this.isRunning = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks = null;
    this.lastSeenId = null;
    console.log('[MQTT] Stopped');
  }

  private connect() {
    if (!this.isRunning) return;

    try {
      this.ws = new WebSocket(MQTT_WS_URL);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('[MQTT] WebSocket connected');
        this.sendMqttConnect();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = () => {
        this.callbacks?.onError('MQTT connection error');
      };

      this.ws.onclose = () => {
        console.log('[MQTT] WebSocket closed');
        this.callbacks?.onDisconnected?.();
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
          this.pingTimer = null;
        }
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.isRunning || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  private sendMqttConnect() {
    const clientId = `emc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const clientIdBytes = new TextEncoder().encode(clientId);
    const protocolName = new TextEncoder().encode('MQTT');
    const variableHeader = new Uint8Array([
      0, 4, ...protocolName, 4, 2, 0, 60,
    ]);
    const payload = new Uint8Array([
      0, clientIdBytes.length, ...clientIdBytes,
    ]);
    const remainingLength = variableHeader.length + payload.length;
    const packet = new Uint8Array([0x10, remainingLength, ...variableHeader, ...payload]);
    this.ws?.send(packet.buffer);
  }

  private sendMqttSubscribe(topic: string) {
    const topicBytes = new TextEncoder().encode(topic);
    const packetId = Math.floor(Math.random() * 65535) + 1;
    const variableHeader = new Uint8Array([
      (packetId >> 8) & 0xFF, packetId & 0xFF,
    ]);
    const payload = new Uint8Array([
      0, topicBytes.length, ...topicBytes, 0,
    ]);
    const remainingLength = variableHeader.length + payload.length;
    const packet = new Uint8Array([0x82, remainingLength, ...variableHeader, ...payload]);
    this.ws?.send(packet.buffer);
  }

  private startPing() {
    if (this.pingTimer) return;
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(new Uint8Array([0xC0, 0x00]).buffer);
      }
    }, 30000);
  }

  private handleMessage(data: any) {
    try {
      if (data instanceof ArrayBuffer) {
        this.processPacket(new Uint8Array(data));
      } else if (data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            this.processPacket(new Uint8Array(reader.result));
          }
        };
        reader.readAsArrayBuffer(data);
      }
    } catch (err) {
      console.error('[MQTT] Message handling error:', err);
    }
  }

  private processPacket(bytes: Uint8Array) {
    if (bytes.length === 0) return;
    const packetType = (bytes[0] >> 4) & 0x0F;

    switch (packetType) {
      case 2: // CONNACK
        console.log('[MQTT] Connected to broker');
        this.callbacks?.onConnected?.();
        for (const topic of this.subscribedTopics) {
          this.sendMqttSubscribe(topic);
        }
        this.startPing();
        break;
      case 3: // PUBLISH
        this.handlePublish(bytes);
        break;
      case 9: // SUBACK
        console.log('[MQTT] Subscription confirmed');
        break;
    }
  }

  private handlePublish(bytes: Uint8Array) {
    try {
      let offset = 1;
      let remainingLength = 0;
      let multiplier = 1;
      let encodedByte;
      do {
        encodedByte = bytes[offset++];
        remainingLength += (encodedByte & 0x7F) * multiplier;
        multiplier *= 128;
      } while ((encodedByte & 0x80) !== 0);

      const topicLength = (bytes[offset] << 8) | bytes[offset + 1];
      offset += 2 + topicLength;

      const qos = (bytes[0] >> 1) & 0x03;
      if (qos > 0) offset += 2;

      const payload = new TextDecoder().decode(bytes.slice(offset));
      const signal = JSON.parse(payload.trim());

      if (signal.id === this.lastSeenId) return;
      this.lastSeenId = signal.id;

      console.log('[MQTT] Signal received:', signal.symbol, signal.direction, '@', signal.entryPrice);

      const dbSignal: DatabaseSignal = {
        id: signal.id || `mqtt-${Date.now()}`,
        ea: '',
        asset: signal.symbol,
        latestupdate: signal.timestamp || new Date().toISOString(),
        type: signal.signalType || 'ENTRY',
        action: signal.direction,
        price: String(signal.entryPrice),
        tp: String(signal.takeProfit || 0),
        sl: String(signal.stopLoss || 0),
        time: signal.timestamp || new Date().toISOString(),
        results: 'active',
      };

      this.callbacks?.onSignalFound(dbSignal);
    } catch (err) {
      console.error('[MQTT] Failed to parse publish message:', err);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      connected: this.ws?.readyState === WebSocket.OPEN,
      topics: this.subscribedTopics,
    };
  }
}

export const mqttSignalsService = new MqttSignalsService();
export default mqttSignalsService;
