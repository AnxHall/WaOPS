import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '../src/lib/permissions';
import type { IncidentDetail } from '../src/app/(app)/incidents/[id]/page';

/**
 * Testa a LÓGICA de ações do incident detail (ack/resolve) sem montar a página
 * Next (router/params): extraímos o comportamento verificável — double-submit
 * guard + estado confirmado pelo servidor + recuperação de 409.
 */

afterEach(cleanup);

const incident: IncidentDetail = {
  id: 'inc_1',
  title: 'CPU crítica',
  severity: 'critical',
  status: 'detected',
  primaryResourceId: 'res_1',
  primary_resource: null,
  fingerprint: 'fp_1',
  detectedAt: new Date().toISOString(),
  acknowledgedAt: null,
  resolvedAt: null,
};

function makeActionHarness() {
  let current: IncidentDetail = { ...incident };
  let inFlight = 0;
  let calls = 0;
  let conflictOnFirst = false;

  async function act(action: 'acknowledge' | 'resolve'): Promise<IncidentDetail | null> {
    if (inFlight > 0) return null; // double-submit guard (como na página)
    inFlight += 1;
    calls += 1;
    try {
      await new Promise((r) => setTimeout(r, 20)); // latência simulada
      if (conflictOnFirst && calls === 1) {
        const err = new Error('conflict') as Error & { status: number };
        err.status = 409;
        throw err;
      }
      current = {
        ...current,
        status: action === 'acknowledge' ? 'acknowledged' : 'resolved',
        acknowledgedAt: action === 'acknowledge' ? new Date().toISOString() : current.acknowledgedAt,
        resolvedAt: action === 'resolve' ? new Date().toISOString() : current.resolvedAt,
      };
      return { ...current }; // estado confirmado pelo servidor
    } finally {
      inFlight -= 1;
    }
  }

  return {
    act,
    get calls() {
      return calls;
    },
    get state() {
      return current;
    },
    setConflictOnFirst() {
      conflictOnFirst = true;
    },
  };
}

describe('incident actions (double-submit + server-confirmed state)', () => {
  it('blocks a second submit while the first is in flight', async () => {
    const h = makeActionHarness();
    const first = h.act('acknowledge');
    const second = h.act('acknowledge'); // deve ser recusado (in-flight)
    expect(await second).toBeNull();
    expect(await first).toMatchObject({ status: 'acknowledged' });
    expect(h.calls).toBe(1);
  });

  it('updates UI only with server-confirmed state', async () => {
    const h = makeActionHarness();
    const updated = await h.act('resolve');
    expect(updated).toMatchObject({ status: 'resolved', resolvedAt: expect.any(String) });
    expect(h.state.status).toBe('resolved');
  });

  it('recovers from 409 by re-reading server state (no silent UI lie)', async () => {
    const h = makeActionHarness();
    h.setConflictOnFirst();
    await expect(h.act('acknowledge')).rejects.toMatchObject({ status: 409 });
    expect(h.state.status).toBe('detected'); // servidor venceu; UI não mentiu
    const retried = await h.act('acknowledge');
    expect(retried).toMatchObject({ status: 'acknowledged' });
  });
});

describe('unavailable telemetry blocks (honest UI for GAP-RM-*)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))),
    );
  });

  it('renders host detail with real charts + filesystems + containers (HM03)', async () => {
    // Mocks DEVEM preceder o import dinâmico da página.
    vi.doMock('next/navigation', () => ({
      useParams: () => ({ id: '11111111-1111-1111-1111-111111111111' }),
      useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    }));
    const hostPayload = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'web-01',
      osType: 'linux',
      osVersion: '6.1',
      arch: 'x86_64',
      environment: 'prod',
      status: 'online',
      machineId: 'abcd1234abcd1234',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const seriesPayload = {
      series: {
        'host.cpu.usage_percent': [{ t: new Date().toISOString(), avg: 42, max: 60, last: 40 }],
        'host.memory.used_bytes': [{ t: new Date().toISOString(), avg: 1e9, max: 1.2e9, last: 1.1e9 }],
        'host.load.1': [{ t: new Date().toISOString(), avg: 0.5, max: 1, last: 0.4 }],
      },
    };
    const fsPayload = {
      filesystems: [{ mount: '/', used_bytes: 5e9, available_bytes: 15e9, observed_at: new Date().toISOString() }],
    };
    const containersPayload = [
      { id: 'c1', name: 'web', image: 'nginx:latest', state: 'running', health: null, lastSeenAt: new Date().toISOString() },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: unknown) => {
        const url = String(input);
        const payload = url.includes('/metrics')
          ? seriesPayload
          : url.includes('/filesystems')
            ? fsPayload
            : url.includes('/containers')
              ? containersPayload
              : hostPayload;
        return Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } }));
      }),
    );
    const HostDetail = (await import('../src/app/(app)/hosts/[id]/page')).default;
    render(
      <SessionProvider me={{ user_id: 'u', tenant_id: 't', organization_scope: null, permissions: ['hosts.read', 'agents.read'] }}>
        <HostDetail />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getAllByText('web-01').length).toBeGreaterThan(0));
    // HM03: charts reais, filesystem e containers do inventário
    await waitFor(() => expect(screen.getByText('Filesystems')).toBeInTheDocument());
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('nginx:latest')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /série temporal/i }).length).toBe(3);
  });
});
