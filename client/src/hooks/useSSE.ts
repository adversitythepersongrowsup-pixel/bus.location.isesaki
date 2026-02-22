import { useEffect, useRef, useCallback } from "react";

type SSEEventHandler = (data: unknown) => void;

type UseSSEOptions = {
  deviceId?: string;
  onMessage?: SSEEventHandler;
  onConnected?: () => void;
  onError?: () => void;
  enabled?: boolean;
};

/**
 * Custom hook for Server-Sent Events (SSE) real-time updates
 * Automatically reconnects on disconnect with exponential backoff
 */
export function useSSE(options: UseSSEOptions = {}) {
  const { deviceId, onMessage, onConnected, onError, enabled = true } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const handlersRef = useRef({ onMessage, onConnected, onError });

  // Keep handlers ref up to date without re-triggering effect
  handlersRef.current = { onMessage, onConnected, onError };

  const connect = useCallback(() => {
    if (!enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = deviceId ? `/api/sse?deviceId=${encodeURIComponent(deviceId)}` : "/api/sse";
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("connected", () => {
      reconnectDelayRef.current = 1000; // Reset backoff on successful connection
      handlersRef.current.onConnected?.();
    });

    es.addEventListener("new_message", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.onMessage?.(data);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("location_update", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.onMessage?.(data);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("notice_updated", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.onMessage?.({ _type: "notice_updated", ...data });
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("arrival_updated", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.onMessage?.({ _type: "arrival_updated", ...data });
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      handlersRef.current.onError?.();
      es.close();
      eventSourceRef.current = null;

      // Exponential backoff reconnect (max 30s)
      const delay = Math.min(reconnectDelayRef.current, 30000);
      reconnectDelayRef.current = Math.min(delay * 2, 30000);

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [deviceId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect, enabled]);

  const close = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return { close };
}

type MessagePayload = {
  id: number;
  senderId: string;
  senderType: string;
  senderName: string | null;
  receiverId: string | null;
  receiverType: string | null;
  content: string;
  isRead: boolean;
  createdAt: string;
};

/**
 * Hook specifically for message SSE events
 * Returns isConnected state and triggers callback on new messages
 */
export function useMessageSSE(options: {
  deviceId?: string;
  onNewMessage?: (msg: MessagePayload) => void;
  onConnected?: () => void;
  onError?: () => void;
  enabled?: boolean;
}) {
  const { deviceId, onNewMessage, onConnected, onError, enabled = true } = options;

  const { close } = useSSE({
    deviceId,
    enabled,
    onConnected,
    onError,
    onMessage: (data) => {
      onNewMessage?.(data as MessagePayload);
    },
  });

  return { close };
}
