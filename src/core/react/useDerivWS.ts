/**
 * React Hook for Deriv WebSocket API Management
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { DerivWSClient, DerivSubscriptionCallback } from '../ws/deriv-ws';
import { DERIV_CONFIG, getEndpoints } from '../config/urls';

export interface UseDerivWSOptions {
  url?: string;
  accountId?: string;
  appId?: string;
  token?: string;
  autoConnect?: boolean;
}

export function useDerivWS(options: UseDerivWSOptions = {}) {
  const {
    url,
    appId = DERIV_CONFIG.appId,
    token,
    autoConnect = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<DerivWSClient | null>(null);

  const defaultWsUrl = `${getEndpoints().ws}?app_id=${appId}&l=en&brand=deriv`;
  const connectionUrl = url || defaultWsUrl;

  // Initialize client once
  useEffect(() => {
    if (!wsRef.current) {
      wsRef.current = new DerivWSClient({
        url: connectionUrl,
        appId,
        token,
      });

      wsRef.current.on('open', () => {
        setIsConnected(true);
        setError(null);
      });

      wsRef.current.on('close', () => {
        setIsConnected(false);
        setIsAuthorized(false);
      });

      wsRef.current.on('error', () => {
        setError(new Error('Deriv WebSocket encountered an error'));
      });
    }

    if (autoConnect) {
      wsRef.current.connect(connectionUrl);
    }

    return () => {
      // Keep alive across re-renders in component tree
    };
  }, [connectionUrl, appId, token, autoConnect]);

  // Update URL if authenticated OTP URL changes
  useEffect(() => {
    if (wsRef.current && url && url !== defaultWsUrl) {
      wsRef.current.connect(url);
    }
  }, [url, defaultWsUrl]);

  const send = useCallback((request: Record<string, any>) => {
    if (!wsRef.current) return Promise.reject(new Error('WebSocket not initialized'));
    return wsRef.current.send(request);
  }, []);

  const subscribe = useCallback((request: Record<string, any>, callback: DerivSubscriptionCallback) => {
    if (!wsRef.current) return () => {};
    return wsRef.current.subscribe(request, callback);
  }, []);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current.connect(connectionUrl);
    }
  }, [connectionUrl]);

  return {
    ws: wsRef.current,
    isConnected,
    isAuthorized,
    error,
    send,
    subscribe,
    reconnect,
  };
}
