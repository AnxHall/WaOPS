import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '../src/lib/permissions';
import { nextStatuses, transitionLabel, TRANSITIONS } from '../src/lib/tickets';
import type { Ticket } from '../src/lib/tickets';

/**
 * Testes da UI de tickets (WaSupport foundation, HM05 follow-up):
 * - TRANSITIONS espelha a máquina de estados do API (tickets.controller.ts);
 * - double-submit guard + recuperação de 409 (mesmo harness do incident detail);
 * - render real da lista com api() mockado: badges, ações por RBAC e chamada
 *   de transição com estado confirmado pelo servidor.
 */

afterEach(cleanup);

describe('TRANSITIONS mirrors the API state machine', () => {
  it('matches tickets.controller.ts TRANSITIONS exactly', () => {
    expect(TRANSITIONS.open).toEqual(['in_progress', 'resolved', 'closed']);
    expect(TRANSITIONS.in_progress).toEqual(['resolved', 'closed', 'open']);
    expect(TRANSITIONS.resolved).toEqual(['closed', 'open']);
    expect(TRANSITIONS.closed).toEqual(['open']);
  });

  it('nextStatuses returns [] for unknown status (defensive) and labels are canonical', () => {
    expect(nextStatuses('deleted')).toEqual([]);
    expect(transitionLabel('in_progress')).toBe('Iniciar');
    expect(transitionLabel('resolved')).toBe('Resolver');
    expect(transitionLabel('closed')).toBe('Fechar');
    expect(transitionLabel('open')).toBe('Reabrir');
  });
});

describe('ticket transition harness (double-submit + server-confirmed state)', () => {
  function makeHarness() {
    let current: string = 'open';
    let inFlight = 0;
    let calls = 0;
    let conflictOnFirst = false;

    async function transition(status: string): Promise<string | null> {
      if (inFlight > 0) return null; // double-submit guard (como na página)
      inFlight += 1;
      calls += 1;
      try {
        await new Promise((r) => setTimeout(r, 20));
        if (conflictOnFirst && calls === 1) {
          const err = new Error('conflict') as Error & { status: number };
          err.status = 409;
          throw err;
        }
        current = status;
        return current; // estado confirmado pelo servidor
      } finally {
        inFlight -= 1;
      }
    }
    return {
      transition,
      get calls() {
        return calls;
      },
      get status() {
        return current;
      },
      setConflictOnFirst() {
        conflictOnFirst = true;
      },
    };
  }

  it('blocks a second submit while the first is in flight', async () => {
    const h = makeHarness();
    const first = h.transition('in_progress');
    const second = h.transition('resolved');
    expect(await second).toBeNull();
    expect(await first).toBe('in_progress');
    expect(h.calls).toBe(1);
  });

  it('recovers from 409 by re-reading server state', async () => {
    const h = makeHarness();
    h.setConflictOnFirst();
    await expect(h.transition('resolved')).rejects.toMatchObject({ status: 409 });
    expect(h.status).toBe('open'); // servidor venceu; UI não mentiu
    const retried = await h.transition('resolved');
    expect(retried).toBe('resolved');
  });
});

// ─── Mounted list page with mocked api() ─────────────────────────────────────

const { apiMock, ApiErrorClass } = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number,
    ) {
      super(message);
    }
  }
  return { apiMock: vi.fn(), ApiErrorClass: ApiError };
});

vi.mock('@/lib/api', () => ({
  api: apiMock,
  ApiError: ApiErrorClass,
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(() => null),
  API: 'http://localhost:3001',
}));

const TicketsPage = (await import('../src/app/(app)/tickets/page')).default;

function ticketFixture(over: Partial<Ticket> = {}): Ticket {
  const now = new Date().toISOString();
  return {
    id: '11111111-1111-1111-1111-111111111111',
    number: 12,
    title: 'Impressora do rack parou',
    description: 'Sem resposta desde ontem',
    status: 'open',
    priority: 'high',
    requesterId: 'u1',
    assigneeId: null,
    incidentId: null,
    labels: ['hardware'],
    openSince: now,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

function renderList(permissions: string[]) {
  return render(
    <SessionProvider me={{ user_id: 'u', tenant_id: 't', organization_scope: null, permissions }}>
      <TicketsPage />
    </SessionProvider>,
  );
}

describe('tickets list page (mounted)', () => {
  it('renders real tickets with number, priority and status badges', async () => {
    apiMock.mockResolvedValue([ticketFixture()]);
    renderList(['tickets.read', 'tickets.create', 'tickets.resolve']);
    await waitFor(() => expect(screen.getByText('Impressora do rack parou')).toBeInTheDocument());
    expect(screen.getByText('#12')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    // open → transições sem reopen na lista: Iniciar/Resolver/Fechar
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reabrir' })).not.toBeInTheDocument();
  });

  it('transition posts to /transition with server-confirmed reload', async () => {
    const t = ticketFixture();
    apiMock.mockImplementation((path: string) => {
      if (path === '/api/v1/tickets') return Promise.resolve([t]);
      if (path === `/api/v1/tickets/${t.id}/transition`) return Promise.resolve({ ...t, status: 'resolved' });
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    renderList(['tickets.read', 'tickets.resolve']);
    await screen.findByRole('button', { name: 'Resolver' });
    fireEvent.click(screen.getByRole('button', { name: 'Resolver' }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith(`/api/v1/tickets/${t.id}/transition`, expect.objectContaining({ method: 'POST' })));
    // reload após o estado confirmado pelo servidor
    await waitFor(() => expect(apiMock.mock.calls.filter(([p]) => p === '/api/v1/tickets').length).toBe(2));
  });

  it('hides actions without permissions (RBAC: backend stays the boundary)', async () => {
    apiMock.mockResolvedValue([ticketFixture()]);
    renderList(['tickets.read']);
    await waitFor(() => expect(screen.getByText('#12')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Novo ticket' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolver' })).not.toBeInTheDocument();
  });

  it('shows the canonical empty state when the tenant has no tickets', async () => {
    apiMock.mockResolvedValue([]);
    renderList(['tickets.read', 'tickets.create']);
    await waitFor(() => expect(screen.getByText('Nenhum ticket')).toBeInTheDocument());
    expect(screen.getByText('Crie o primeiro ticket de suporte')).toBeInTheDocument();
  });
});
