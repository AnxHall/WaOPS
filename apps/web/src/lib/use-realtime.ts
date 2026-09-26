'use client';

import { useEffect, useRef, useState } from 'react';
import { RealtimeClient, type RealtimeEvent, type RealtimeStatus } from '@/lib/sse';
import { getAccessToken } from '@/lib/api';

/**
 * ADR-010 — React binding for the realtime SSE stream.
 *
 * Handlers are passed as a map of event-type → callback and kept in a ref, so
 * the stream is opened ONCE per mounted component regardless of re-renders
 * (closures always see the latest callback). Status reflects the connection
 * lifecycle so the UI can show a live/stale indicator.
 */
export function useRealtime(handlers: Record<string, (e: RealtimeEvent) => void>): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const client = new RealtimeClient({
      getToken: () => getAccessToken(),
      onStatus: setStatus,
    });
    const unsubscribes = Object.entries(handlersRef.current).map(([type, handler]) =>
      client.subscribe(type, handler),
    );
    client.start();
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
      client.stop();
    };
    // stream lifecycle is bound to mount; handlers are read via ref
  }, []);

  return status;
}
