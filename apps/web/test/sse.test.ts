import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeClient, SseParser, type RealtimeEvent } from '@/lib/sse';

// ---------------------------------------------------------------------------
// SseParser — wire format
// ---------------------------------------------------------------------------
describe('SseParser', () => {
  it('parses id/event/data frames and keeps the id persistent', () => {
    const parser = new SseParser();
    const frames = parser.push('id: 7\nevent: incident.created\ndata: {"a":1}\n\n: keep-alive\n\n');
    expect(frames).toEqual([{ id: '7', event: 'incident.created', data: '{"a":1}' }]);
  });

  it('buffers frames split across chunks (CRLF included)', () => {
    const parser = new SseParser();
    expect(parser.push('id: 1\r\n')).toEqual([]); // id consumed, frame open
    expect(parser.push('event: agent.heartbeat\r\ndata: {"x":2}\r\n')).toEqual([]);
    // final CRLF: the \r ends the (empty) last line, the \n is the blank line
    const frames = parser.push('\r\n');
    expect(frames).toEqual([{ id: '1', event: 'agent.heartbeat', data: '{"x":2}' }]);
  });

  it('joins multi-line data with newlines and dispatches on blank line only', () => {
    const parser = new SseParser();
    expect(parser.push('data: l1\ndata: l2\n')).toEqual([]);
    const frames = parser.push('\n');
    expect(frames).toEqual([{ id: '', event: 'message', data: 'l1\nl2' }]);
  });

  it('ignores comment-only traffic (heartbeats) and bad id fields', () => {
    const parser = new SseParser();
    expect(parser.push(': ping\n\n')).toEqual([]);
    expect(parser.push('id: a\0b\ndata: x\n\n')).toEqual([{ id: '', event: 'message', data: 'x' }]);
  });
});

// ---------------------------------------------------------------------------
// RealtimeClient — transport behaviour
// ---------------------------------------------------------------------------
type Deferred = { resolve: (v: Response) => void; promise: Promise<Response> };

function deferredResponse(): Deferred {
  let resolve!: (v: Response) => void;
  const promise = new Promise<Response>((r) => (resolve = r));
  return { resolve, promise };
}

/** ReadableStream of raw SSE text that can be extended/ended by the test. */
function sseStream(controller: (c: ReadableStreamDefaultController<Uint8Array>) => void): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({ start: controller });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

describe('RealtimeClient', () => {
  let controllers: ReadableStreamDefaultController<Uint8Array>[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    controllers = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeClient(overrides: {
    fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    onStatus?: (s: string) => void;
    onError?: (e: unknown) => void;
    jitter?: () => number;
  }): RealtimeClient {
    const client = new RealtimeClient({
      getToken: () => 'tok',
      url: 'http://api.test/stream',
      maxBackoffMs: 2000,
      ...overrides,
    });
    return client;
  }

  it('receives events and dispatches to the matching handler', async () => {
    const events: RealtimeEvent[] = [];
    const pending = deferredResponse();
    const fetchImpl = vi.fn().mockReturnValue(pending.promise);
    const client = makeClient({ fetchImpl });
    client.subscribe('incident.created', (e) => events.push(e));
    pending.resolve(
      sseStream((c) => {
        controllers.push(c);
        c.enqueue(new TextEncoder().encode('id: 1\nevent: incident.created\ndata: {"id":"1","type":"incident.created","channel":"incidents","occurred_at":"t","payload":{}}\n\n'));
      }),
    );
    client.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toEqual({});
    client.stop();
  });

  it('sends Last-Event-ID on reconnect after the stream drops', async () => {
    const pending = deferredResponse();
    const calls: (string | undefined)[] = [];
    let n = 0;
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Headers(init?.headers).get('last-event-id') ?? undefined);
      return n++ === 0 ? pending.promise : deferredResponse().promise;
    });
    const client = makeClient({ fetchImpl });
    pending.resolve(
      sseStream((c) => {
        controllers.push(c);
        c.enqueue(new TextEncoder().encode('id: 42\nevent: incident.created\ndata: {"id":"42"}\n\n'));
        c.close();
      }),
    );
    client.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(calls[0]).toBeUndefined();
    await vi.advanceTimersByTimeAsync(3000); // run out the backoff
    expect(calls[1]).toBe('42');
    client.stop();
  });

  it('reconnects with capped backoff and jitter window', async () => {
    const pending = deferredResponse();
    let n = 0;
    const fetchImpl = vi.fn(() => (n++ === 0 ? pending.promise : deferredResponse().promise));
    const client = makeClient({ fetchImpl, jitter: () => 1 });
    pending.resolve(
      sseStream((c) => {
        controllers.push(c);
        c.close();
      }),
    );
    client.start();
    await vi.advanceTimersByTimeAsync(5);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(499); // base backoff 500 with jitter=1 → ~500ms
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    client.stop();
  });

  it('stops retrying and reports unauthorized on 401', async () => {
    const statuses: string[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    const client = makeClient({ fetchImpl, onStatus: (s) => statuses.push(s) });
    client.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(statuses).toContain('unauthorized');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // no retry storm
    client.stop();
  });

  it('deduplicates repeated SSE ids (at-least-once replay)', async () => {
    const events: RealtimeEvent[] = [];
    const pending = deferredResponse();
    const client = makeClient({ fetchImpl: vi.fn().mockReturnValue(pending.promise) });
    client.subscribe('incident.created', (e) => events.push(e));
    pending.resolve(
      sseStream((c) => {
        controllers.push(c);
        const frame = 'id: 9\nevent: incident.created\ndata: {"id":"9"}\n\n';
        c.enqueue(new TextEncoder().encode(frame + frame + frame));
      }),
    );
    client.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(events).toHaveLength(1);
    client.stop();
  });
});
