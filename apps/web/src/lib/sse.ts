'use client';

/**
 * ADR-010 — Realtime SSE client for the dashboard.
 *
 * Why not native EventSource: the stream authenticates with the Bearer access
 * token (in memory — ADR on auth; the tenant is ALWAYS derived from the JWT on
 * the server, never from a query param). EventSource cannot send headers, so
 * this client implements the server push protocol over fetch + ReadableStream:
 *
 *  - GET {API}/api/v1/realtime/stream?channels=...  (Authorization: Bearer)
 *  - frames `id:` / `event:` / `data:` per the SSE wire format
 *  - reconnects with capped exponential backoff + jitter, resuming from the
 *    last received `id:` via the `Last-Event-ID` header (server replays the
 *    retained per-tenant ring buffer)
 *  - deduplicates frames by SSE id (at-least-once redelivery across reconnects)
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type RealtimeStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'unauthorized';

export interface RealtimeEvent {
  id: string;
  channel: string;
  type: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface SseFrame {
  id: string;
  event: string;
  data: string;
}

export interface RealtimeClientOptions {
  /** Channel names (validated server-side); defaults to the ADR-010 pair. */
  channels?: readonly string[];
  /** Access-token provider (defaults to the in-memory token from lib/api). */
  getToken?: () => string | null;
  /** Stream endpoint; overridable for tests. */
  url?: string;
  fetchImpl?: typeof fetch;
  onStatus?: (status: RealtimeStatus) => void;
  onError?: (err: unknown) => void;
  maxBackoffMs?: number;
  /** Deterministic jitter for tests; production uses Math.random. */
  jitter?: () => number;
}

const BASE_BACKOFF_MS = 500;
const DEDUP_WINDOW = 64;

/**
 * Incremental parser for the text/event-stream wire format (WHATWG "processing
 * model" subset: field/value lines, multi-line data, comment lines, dispatch on
 * blank line). The `id` field intentionally persists across events.
 */
export class SseParser {
  private buffer = '';
  private data: string[] = [];
  private eventName = '';
  private id = '';

  push(chunk: string): SseFrame[] {
    this.buffer += chunk;
    const frames: SseFrame[] = [];
    let nl: number;
    while ((nl = this.buffer.indexOf('\n')) >= 0) {
      let line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line === '') {
        const frame = this.dispatch();
        if (frame) frames.push(frame);
      } else if (line.startsWith(':')) {
        // comment / keep-alive heartbeat — ignored
      } else {
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? '' : line.slice(colon + 1);
        if (value.startsWith(' ')) value = value.slice(1);
        if (field === 'data') this.data.push(value);
        else if (field === 'event') this.eventName = value;
        else if (field === 'id' && !value.includes('\0')) this.id = value;
        // `retry` is server-advised; we manage our own backoff.
      }
    }
    return frames;
  }

  private dispatch(): SseFrame | null {
    if (this.data.length === 0) {
      this.eventName = '';
      return null;
    }
    const frame = { id: this.id, event: this.eventName || 'message', data: this.data.join('\n') };
    this.data = [];
    this.eventName = '';
    return frame;
  }
}

export class RealtimeClient {
  private readonly handlers = new Map<string, Set<(e: RealtimeEvent) => void>>();
  private readonly opts: Required<Pick<RealtimeClientOptions, 'maxBackoffMs' | 'jitter'>> & RealtimeClientOptions;
  private controller: AbortController | null = null;
  private runToken = 0;
  private running = false;
  private stopped = true;
  private status: RealtimeStatus = 'closed';
  private wake?: (early: boolean) => void;
  private recentIds = new Set<string>();
  private recentIdQueue: string[] = [];

  constructor(options: RealtimeClientOptions = {}) {
    this.opts = { maxBackoffMs: 15_000, jitter: Math.random, ...options };
  }

  get currentStatus(): RealtimeStatus {
    return this.status;
  }

  subscribe(channel: string, handler: (e: RealtimeEvent) => void): () => void {
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
      if (set && set.size === 0) this.handlers.delete(channel);
    };
  }

  start(startId?: string): void {
    if (this.running) return;
    this.running = true;
    this.stopped = false;
    this.controller = new AbortController();
    const token = ++this.runToken;
    void this.run(token, startId);
  }

  stop(): void {
    this.stopped = true;
    this.runToken++;
    this.controller?.abort();
    this.controller = null;
    this.running = false;
    this.wake?.(true);
    this.setStatus('closed');
  }

  private setStatus(next: RealtimeStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.opts.onStatus?.(next);
  }

  /** Capped exponential backoff; aborts early when stop() is called. */
  private async backoff(attempt: number): Promise<void> {
    const capped = Math.min(BASE_BACKOFF_MS * 2 ** Math.min(attempt, 10), this.opts.maxBackoffMs);
    // full jitter within [capped/2, capped) — avoids reconnect stampedes
    const delay = capped * (0.5 + this.opts.jitter() * 0.5);
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        this.wake = undefined;
        resolve();
      }, delay);
      this.wake = (early) => {
        if (!early) return;
        clearTimeout(t);
        this.wake = undefined;
        resolve();
      };
    });
  }

  private async run(token: number, startId?: string): Promise<void> {
    let attempt = 0;
    let cursor = startId;
    const live = () => !this.stopped && this.runToken === token;

    try {
      while (live()) {
        this.setStatus(attempt === 0 ? 'connecting' : 'reconnecting');
        const token_: string | null = this.opts.getToken ? this.opts.getToken() : null;
        const channels = this.opts.channels ?? ['incidents', 'agents'];
        const url =
          this.opts.url ?? `${API}/api/v1/realtime/stream?channels=${encodeURIComponent(channels.join(','))}`;

        let res: Response;
        try {
          if (!token_) throw new Error('realtime: no access token');
          res = await (this.opts.fetchImpl ?? fetch)(url, {
            headers: {
              authorization: `Bearer ${token_}`,
              accept: 'text/event-stream',
              ...(cursor ? { 'last-event-id': cursor } : {}),
            },
            signal: this.controller!.signal,
          });
        } catch (err) {
          if (!live()) break;
          this.opts.onError?.(err);
          await this.backoff(attempt++);
          continue;
        }

        if (res.status === 401 || res.status === 403) {
          // Token expired/invalid: surface to the hook so the app can refresh
          // and re-subscribe; a blind retry would just burn the rate limit.
          this.setStatus('unauthorized');
          break;
        }
        if (!res.ok || !res.body) {
          this.opts.onError?.(new Error(`realtime stream HTTP ${res.status}`));
          await this.backoff(attempt++);
          continue;
        }

        attempt = 0;
        this.setStatus('open');
        const parser = new SseParser();
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let streamError: unknown = null;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
              if (frame.id) cursor = frame.id;
              if (this.isDuplicate(frame.id)) continue;
              this.dispatchFrame(frame);
            }
          }
        } catch (err) {
          streamError = err;
        }
        if (!live()) break;
        if (streamError) this.opts.onError?.(streamError);
        // Server closed the stream (deploy/restart/timeout): reconnect.
        await this.backoff(attempt++);
      }
    } finally {
      if (this.runToken === token) this.setStatus('closed');
    }
  }

  private isDuplicate(id: string): boolean {
    if (!id) return false;
    if (this.recentIds.has(id)) return true;
    this.recentIds.add(id);
    this.recentIdQueue.push(id);
    if (this.recentIdQueue.length > DEDUP_WINDOW) {
      const oldest = this.recentIdQueue.shift();
      if (oldest !== undefined) this.recentIds.delete(oldest);
    }
    return false;
  }

  private dispatchFrame(frame: SseFrame): void {
    let parsed: RealtimeEvent;
    try {
      parsed = JSON.parse(frame.data) as RealtimeEvent;
    } catch {
      return; // malformed payload — never break the stream
    }
    const set = this.handlers.get(frame.event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(parsed);
      } catch {
        // handler errors must not kill the connection loop
      }
    }
  }
}
