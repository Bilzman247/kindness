/**
 * Lightweight Deriv WebSocket Client with Request/Response & Streaming Subscriptions
 */

export interface DerivWSResponse<T = any> {
  req_id?: number;
  msg_type?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  [key: string]: any;
}

export type DerivSubscriptionCallback = (data: DerivWSResponse) => void;

export interface DerivWSOptions {
  url?: string;
  appId?: string;
  token?: string;
  pingIntervalMs?: number;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
}

export class DerivWSClient {
  private url: string;
  private ws: WebSocket | null = null;
  private reqIdCounter = 1;
  private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void; timer: any }>();
  private subscriptions = new Map<string, DerivSubscriptionCallback>();
  private pingTimer: any = null;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private isExplicitlyClosed = false;
  private options: DerivWSOptions;

  public isConnected = false;
  public isAuthorized = false;

  private listeners = {
    open: new Set<() => void>(),
    close: new Set<(event: CloseEvent) => void>(),
    error: new Set<(event: Event) => void>(),
    message: new Set<(data: any) => void>(),
  };

  constructor(options: DerivWSOptions = {}) {
    this.options = {
      pingIntervalMs: 25000,
      reconnectIntervalMs: 3000,
      maxReconnectAttempts: 10,
      ...options,
    };
    this.url = options.url || 'wss://ws.derivws.com/websockets/v3?app_id=33E1sj7WNaMsjg5MAxPyS&l=en&brand=deriv';
  }

  public connect(newUrl?: string): void {
    if (newUrl) this.url = newUrl;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        // If a token was provided, authorize automatically
        if (this.options.token) {
          this.authorize(this.options.token).catch((err) => {
            console.warn('Auto-authorize failed:', err);
          });
        }

        this.listeners.open.forEach((fn) => fn());
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as DerivWSResponse;
          this.handleMessage(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onerror = (event: Event) => {
        this.listeners.error.forEach((fn) => fn(event));
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.isConnected = false;
        this.isAuthorized = false;
        this.stopHeartbeat();
        this.rejectPendingRequests('WebSocket connection closed.');
        this.listeners.close.forEach((fn) => fn(event));

        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (e) {
      console.error('Failed to create WebSocket instance:', e);
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isAuthorized = false;
  }

  /**
   * Send a JSON request and await response matched by req_id
   */
  public send<T = any>(request: Record<string, any>, timeoutMs = 15000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket is not connected.'));
      }

      const req_id = this.reqIdCounter++;
      const payload = { ...request, req_id };

      const timer = setTimeout(() => {
        if (this.pendingRequests.has(req_id)) {
          this.pendingRequests.delete(req_id);
          reject(new Error(`Deriv WS Request timeout (req_id: ${req_id})`));
        }
      }, timeoutMs);

      this.pendingRequests.set(req_id, { resolve, reject, timer });

      try {
        this.ws.send(JSON.stringify(payload));
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(req_id);
        reject(err);
      }
    });
  }

  /**
   * Subscribe to a streaming endpoint (e.g. ticks, proposal_open_contract)
   */
  public subscribe(
    request: Record<string, any>,
    callback: DerivSubscriptionCallback
  ): () => void {
    const subKey = JSON.stringify(request);
    this.subscriptions.set(subKey, callback);

    // Send subscribe request
    this.send({ ...request, subscribe: 1 }).catch((err) => {
      console.warn('Subscription send failed:', err);
    });

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(subKey);
      // Try to send forget if subscription id exists
      if (request.ticks) {
        this.send({ forget: request.ticks }).catch(() => {});
      }
    };
  }

  /**
   * Authorize session with token
   */
  public async authorize(token: string): Promise<any> {
    const res = await this.send({ authorize: token });
    if (!res.error) {
      this.isAuthorized = true;
    }
    return res;
  }

  /**
   * Event listeners
   */
  public on(event: 'open', cb: () => void): () => void;
  public on(event: 'close', cb: (e: CloseEvent) => void): () => void;
  public on(event: 'error', cb: (e: Event) => void): () => void;
  public on(event: 'message', cb: (data: any) => void): () => void;
  public on(event: string, cb: any): () => void {
    const set = (this.listeners as any)[event];
    if (set) {
      set.add(cb);
      return () => set.delete(cb);
    }
    return () => {};
  }

  private handleMessage(data: DerivWSResponse): void {
    this.listeners.message.forEach((fn) => fn(data));

    // Handle req_id matching
    if (data.req_id && this.pendingRequests.has(data.req_id)) {
      const { resolve, reject, timer } = this.pendingRequests.get(data.req_id)!;
      clearTimeout(timer);
      this.pendingRequests.delete(data.req_id);

      if (data.error) {
        reject(new Error(data.error.message || 'Deriv API error'));
      } else {
        resolve(data);
      }
    }

    // Handle streaming subscriptions (ticks, balance, proposal_open_contract, etc.)
    if (data.tick || data.balance || data.proposal_open_contract || data.subscription || data.msg_type) {
      this.subscriptions.forEach((cb) => cb(data));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ ping: 1 }).catch(() => {});
      }
    }, this.options.pingIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.options.maxReconnectAttempts || 10)) {
      console.warn('Max reconnect attempts reached for Deriv WebSocket.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(10000, (this.options.reconnectIntervalMs || 3000) * Math.pow(1.5, this.reconnectAttempts - 1));

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, delay);
  }

  private rejectPendingRequests(reason: string): void {
    this.pendingRequests.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(new Error(reason));
    });
    this.pendingRequests.clear();
  }
}
