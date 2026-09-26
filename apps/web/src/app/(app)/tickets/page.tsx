'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/permissions';
import { relativeTime } from '@/lib/status';
import { useRealtime } from '@/lib/use-realtime';
import { EmptyState, PermissionDeniedState, Skeleton, StatusBadge } from '@/components/states';
import { nextStatuses, transitionLabel, type Ticket } from '@/lib/tickets';

/**
 * Tickets (WaSupport foundation, HARD MISSION 05) — dados REAIS de /api/v1/tickets.
 * Padrões: designer.md §7 (skeleton/empty/error), RBAC via useSession().can() e
 * double-submit guard; backend continua a authorization boundary.
 * Número do ticket é per-tenant sequencial (ex.: #3).
 */

export default function TicketsPage() {
  const { can } = useSession();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal' });
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<Ticket[]>('/api/v1/tickets')
      .then(setTickets)
      .catch(setError);
  }, []);

  useEffect(() => {
    load();
    // Safety-net poll: SSE carries freshness; bounds staleness to 30s (at-least-once).
    const poll = setInterval(load, 30_000);
    return () => {
      clearInterval(poll);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [load]);

  // ADR-010: eventos de ticket disparam refetch debounced da lista.
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(load, 400);
  }, [load]);

  const realtimeStatus = useRealtime({
    'ticket.created': scheduleReload,
    'ticket.transitioned': scheduleReload,
  });

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return; // double-submit guard
    setCreating(true);
    setFormError(null);
    try {
      await api('/api/v1/tickets', { method: 'POST', body: JSON.stringify(form) });
      setForm({ title: '', description: '', priority: 'normal' });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao criar ticket');
    } finally {
      setCreating(false);
    }
  }

  async function transition(t: Ticket, status: string) {
    if (busyId) return; // double-submit guard
    setBusyId(t.id);
    try {
      await api(`/api/v1/tickets/${t.id}/transition`, { method: 'POST', body: JSON.stringify({ status }) });
      load(); // estado confirmado pelo servidor (POST retorna 201 Ticket)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        load(); // estado do servidor vence (transição venceu em outra sessão)
      } else {
        setError(err instanceof Error ? err : new Error('Falha na transição'));
      }
    } finally {
      setBusyId(null);
    }
  }

  const liveBadge =
    realtimeStatus === 'open'
      ? { cls: 'badge ok', label: 'live' }
      : realtimeStatus === 'reconnecting' || realtimeStatus === 'connecting'
        ? { cls: 'badge warning', label: 'reconectando…' }
        : realtimeStatus === 'unauthorized'
          ? { cls: 'badge critical', label: 'sessão expirada' }
          : { cls: 'badge neutral', label: 'offline' };

  return (
    <>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        Tickets <span className={liveBadge.cls} title={`realtime: ${realtimeStatus}`}>{liveBadge.label}</span>
        {can('tickets.create') && (
          <button className="btn ghost" onClick={() => setShowForm((v) => !v)} type="button">
            {showForm ? 'Cancelar' : 'Novo ticket'}
          </button>
        )}
      </h1>

      {showForm && can('tickets.create') && (
        <form className="card" onSubmit={createTicket} style={{ marginBottom: 16 }} aria-label="Novo ticket">
          <label>
            <span className="muted">Título</span>
            <input
              className="input"
              placeholder="Resumo do problema"
              value={form.title}
              maxLength={200}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <label>
            <span className="muted">Descrição</span>
            <textarea
              className="input"
              placeholder="Descreva o problema, impacto e passos para reproduzir"
              value={form.description}
              maxLength={10_000}
              rows={4}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </label>
          <label>
            <span className="muted">Prioridade</span>
            <select
              className="input"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </select>
          </label>
          {formError && (
            <p role="alert" style={{ color: 'var(--status-critical)', margin: '8px 0 0' }}>
              {formError}
            </p>
          )}
          <button className="btn primary" disabled={creating} type="submit">
            {creating ? 'Criando…' : 'Criar ticket'}
          </button>
        </form>
      )}

      {error instanceof ApiError && (error.status === 401 || error.status === 403) ? (
        <PermissionDeniedState what="tickets (tickets.read)" />
      ) : error ? (
        <div className="card state-error" role="alert" style={{ marginBottom: 16 }}>
          <strong>Erro ao carregar tickets</strong>
          <span className="muted">{error.message}</span>
          <button className="btn ghost" onClick={load} type="button">
            Tentar novamente
          </button>
        </div>
      ) : tickets === null ? (
        <div className="card">
          <Skeleton h={200} />
        </div>
      ) : tickets.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="✓"
            title="Nenhum ticket"
            description={
              can('tickets.create') ? 'Crie o primeiro ticket de suporte' : 'Sem solicitações de suporte no momento'
            }
          />
        </div>
      ) : (
        <div className="card">
          <table className="data">
            <thead>
              <tr>
                <th>Número</th>
                <th>Título</th>
                <th>Prioridade</th>
                <th>Estado</th>
                <th>Aberto</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td data-label="Número" className="mono-id">
                    #{t.number}
                  </td>
                  <td data-label="Título">
                    <Link href={`/tickets/${t.id}`}>{t.title}</Link>
                  </td>
                  <td data-label="Prioridade">
                    <StatusBadge status={t.priority} tone={priorityTone(t.priority)} />
                  </td>
                  <td data-label="Estado">
                    <StatusBadge status={t.status} tone={ticketStatusTone(t.status)} />
                  </td>
                  <td data-label="Aberto" className="muted">
                    {relativeTime(t.openSince)}
                  </td>
                  <td data-label="Ações">
                    {can('tickets.resolve') &&
                      nextStatuses(t.status)
                        .filter((s) => s !== 'open')
                        .map((s) => (
                          <button
                            key={s}
                            className="btn ghost"
                            disabled={busyId !== null}
                            onClick={() => transition(t, s)}
                            type="button"
                          >
                            {busyId === t.id ? '…' : transitionLabel(s)}
                          </button>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Prioridade → tone (designer.md: nunca só cor — badge sempre tem label). */
function priorityTone(priority: string): 'ok' | 'info' | 'warning' | 'critical' | 'neutral' {
  switch (priority) {
    case 'urgent':
      return 'critical';
    case 'high':
      return 'warning';
    case 'low':
      return 'neutral';
    default:
      return 'info';
  }
}

/** Estado do ticket → tone (closed = neutro/terminal; open = atenção). */
function ticketStatusTone(status: string): 'ok' | 'info' | 'warning' | 'critical' | 'neutral' {
  switch (status) {
    case 'open':
      return 'warning';
    case 'in_progress':
      return 'info';
    case 'resolved':
      return 'ok';
    case 'closed':
      return 'neutral';
    default:
      return 'neutral';
  }
}

