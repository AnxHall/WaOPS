'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/permissions';
import { relativeTime } from '@/lib/status';
import {
  ErrorState,
  PermissionDeniedState,
  Skeleton,
  StatusBadge,
} from '@/components/states';
import { nextStatuses, transitionLabel, type Ticket } from '@/lib/tickets';

/**
 * Ticket detail (WaSupport foundation) — dados REAIS de /api/v1/tickets/:id.
 * Mesmos padrões do incident detail: 404 diferenciado, permission denied,
 * double-submit guard, recuperação de 409 re-lendo o estado do servidor.
 * Transições usam a máquina do API (open → in_progress → resolved → closed
 * com reopen; terminal = closed).
 */

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { can } = useSession();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // double-submit guard
  const [commentBody, setCommentBody] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    // GET /tickets/:id retorna o ticket com comments embutidos (as-built).
    api<Ticket>(`/api/v1/tickets/${id}`)
      .then(setTicket)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  async function transition(status: string) {
    if (!ticket || busy) return; // double-submit guard
    setBusy(status);
    setActionError(null);
    try {
      await api(`/api/v1/tickets/${ticket.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      load(); // estado confirmado pelo servidor
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setActionError('O ticket mudou de estado. Atualizando…');
        load(); // estado do servidor vence
      } else {
        setActionError(err instanceof Error ? err.message : 'Falha na transição');
      }
    } finally {
      setBusy(null);
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || posting) return; // double-submit guard
    setPosting(true);
    setCommentError(null);
    try {
      await api(`/api/v1/tickets/${ticket.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody }),
      });
      setCommentBody('');
      setTicket(await api<Ticket>(`/api/v1/tickets/${ticket.id}`)); // re-lê com comments
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Falha ao comentar');
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <>
        <h1 className="page-title">Carregando…</h1>
        <div className="card">
          <Skeleton h={20} w="50%" />
          <div style={{ height: 16 }} />
          <Skeleton h={120} />
        </div>
      </>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <>
        <h1 className="page-title">Ticket não encontrado</h1>
        <ErrorState
          message="Ticket não encontrado"
          detail="O ticket não existe neste tenant ou o ID pertence a outro tenant."
          onRetry={load}
        />
      </>
    );
  }

  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return (
      <>
        <h1 className="page-title">Tickets</h1>
        <PermissionDeniedState what="tickets (tickets.read)" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 className="page-title">Ticket</h1>
        <ErrorState message="Erro ao carregar ticket" detail={error.message} onRetry={load} />
      </>
    );
  }

  if (!ticket) return null;

  const priorities = ['low', 'normal', 'high', 'urgent'];
  const statusTone =
    ticket.status === 'open'
      ? 'warning'
      : ticket.status === 'in_progress'
        ? 'info'
        : ticket.status === 'resolved'
          ? 'ok'
          : 'neutral';
  const priorityTone =
    ticket.priority === 'urgent'
      ? 'critical'
      : ticket.priority === 'high'
        ? 'warning'
        : ticket.priority === 'low'
          ? 'neutral'
          : 'info';

  return (
    <>
      <nav className="muted" aria-label="Trilha de navegação">
        <Link href="/tickets">Tickets</Link> / #{ticket.number}
      </nav>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        #{ticket.number} {ticket.title}
        <StatusBadge status={ticket.priority} tone={priorityTone} />
        <StatusBadge status={ticket.status} tone={statusTone} />
      </h1>

      {actionError && (
        <div className="card" role="alert" style={{ marginBottom: 16, color: 'var(--status-critical)' }}>
          {actionError}
        </div>
      )}

      <div className="grid cols-2">
        <section className="card" aria-labelledby="tk-detail">
          <h2 className="card-title" id="tk-detail">
            Detalhe
          </h2>
          <dl className="kv">
            <div>
              <dt>Descrição</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</dd>
            </div>
            <div>
              <dt>Labels</dt>
              <dd>{ticket.labels.length ? ticket.labels.join(', ') : '—'}</dd>
            </div>
            <div>
              <dt>Incidente vinculado</dt>
              <dd>
                {ticket.incidentId ? (
                  <Link href={`/incidents/${ticket.incidentId}`}>ver incidente</Link>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt>Aberto</dt>
              <dd title={ticket.openSince}>{relativeTime(ticket.openSince)}</dd>
            </div>
            <div>
              <dt>Resolvido</dt>
              <dd>{ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString('pt-BR') : '—'}</dd>
            </div>
          </dl>

          {can('tickets.resolve') && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {nextStatuses(ticket.status).map((s) => (
                <button
                  key={s}
                  className={s === 'closed' ? 'btn ghost' : 'btn primary'}
                  disabled={busy !== null}
                  onClick={() => transition(s)}
                  type="button"
                >
                  {busy === s ? '…' : transitionLabel(s)}
                </button>
              ))}
            </div>
          )}
          {!can('tickets.resolve') && nextStatuses(ticket.status).length > 0 && (
            <p className="muted" style={{ marginBottom: 0 }}>
              Sem permissão para transições neste ticket (tickets.resolve).
            </p>
          )}
        </section>

        <section className="card" aria-labelledby="tk-comments">
          <h2 className="card-title" id="tk-comments">
            Comentários
          </h2>
          {ticket.comments === undefined ? (
            <Skeleton h={120} />
          ) : ticket.comments.length === 0 ? (
            <p className="muted">Sem comentários.</p>
          ) : (
            <div className="timeline">
              {ticket.comments.map((c) => (
                <div className="timeline-entry" key={c.id}>
                  <div className="timeline-icon" aria-hidden>
                    💬
                  </div>
                  <div>
                    <div className="muted mono-id">
                      {new Date(c.createdAt).toLocaleString('pt-BR')} · {c.authorId.slice(0, 8)}…
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {can('tickets.create') && (
            <form onSubmit={addComment} style={{ marginTop: 12 }}>
              <label>
                <span className="muted">Novo comentário</span>
                <textarea
                  className="input"
                  value={commentBody}
                  maxLength={5000}
                  rows={3}
                  onChange={(e) => setCommentBody(e.target.value)}
                  required
                />
              </label>
              {commentError && (
                <p role="alert" style={{ color: 'var(--status-critical)', margin: '8px 0 0' }}>
                  {commentError}
                </p>
              )}
              <button className="btn ghost" disabled={posting} type="submit">
                {posting ? 'Enviando…' : 'Comentar'}
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
