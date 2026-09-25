'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/permissions';
import { relativeTime, resourceStatusTone } from '@/lib/status';
import { EmptyState, ErrorState, PermissionDeniedState, Skeleton, StatusBadge } from '@/components/states';

/**
 * Agents admin (HARD MISSION 03 — GAP-RM-005 fechado):
 * GET /agents · POST /agents/enrollment-tokens · POST /agents/:id/revoke.
 * Token one-time exibido uma única vez (designer.md §6.4 modal escuro).
 */

interface AgentRow {
  id: string;
  name: string;
  version: string | null;
  protocolVersion: number | null;
  status: string;
  lastSeenAt: string | null;
  machineId: string | null;
  hostId: string | null;
  capabilities: string[];
}

interface TokenCreated {
  token: string;
  token_id: string;
  expires_at: string;
}

export default function AgentsPage() {
  const { can } = useSession();
  const [agents, setAgents] = useState<AgentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [token, setToken] = useState<TokenCreated | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<AgentRow[]>('/api/v1/agents')
      .then(setAgents)
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setError('__forbidden__');
        else setError(e instanceof Error ? e.message : 'erro');
      });
  }, []);

  useEffect(load, [load]);

  async function createToken() {
    setActionError(null);
    try {
      const t = await api<TokenCreated>('/api/v1/agents/enrollment-tokens', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setToken(t);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'falha ao criar token');
    }
  }

  async function revoke(agent: AgentRow) {
    if (busyId) return; // double-submit guard
    setBusyId(agent.id);
    setActionError(null);
    try {
      await api(`/api/v1/agents/${agent.id}/revoke`, { method: 'POST' });
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'falha ao revogar');
    } finally {
      setBusyId(null);
    }
  }

  if (error === '__forbidden__') {
    return (
      <>
        <h1 className="page-title">Agents</h1>
        <PermissionDeniedState what="agentes (agents.read)" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 className="page-title">Agents</h1>
        <ErrorState message="Erro ao carregar agentes" detail={error} onRetry={load} />
      </>
    );
  }

  return (
    <>
      <h1 className="page-title">Agents</h1>
      {actionError && (
        <div className="card" role="alert" style={{ marginBottom: 16, color: 'var(--status-critical)' }}>
          {actionError}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            Agentes registrados
          </h2>
          {can('agents.enroll') && (
            <button className="btn primary" onClick={createToken} type="button">
              Novo enrollment token
            </button>
          )}
        </div>

        {token && (
          <div
            className="card"
            style={{ marginTop: 16, background: 'var(--surface-dark)', color: 'var(--text-inverse)' }}
            role="alert"
          >
            <strong>Token one-time — expira {new Date(token.expires_at).toLocaleTimeString('pt-BR')}</strong>
            <code style={{ display: 'block', marginTop: 8, wordBreak: 'break-all' }}>{token.token}</code>
            <span className="muted" style={{ color: 'rgba(250,250,250,.6)' }}>
              Copie agora: este token expira em 15 minutos e só pode ser usado uma vez.
            </span>
            <button className="btn ghost" onClick={() => setToken(null)} type="button" style={{ marginTop: 8 }}>
              Fechei
            </button>
          </div>
        )}

        {agents === null ? (
          <div className="skeleton" style={{ height: 160, marginTop: 16 }} />
        ) : agents.length === 0 ? (
          <EmptyState
            icon="🤖"
            title="Nenhum agente"
            description="Crie um enrollment token e instale o WaAgent no seu host Linux."
          />
        ) : (
          <table className="data" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Versão</th>
                <th>Estado</th>
                <th>Último heartbeat</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const busy = busyId === a.id;
                return (
                  <tr key={a.id}>
                    <td data-label="Nome">{a.name}</td>
                    <td data-label="Versão" className="muted">
                      {a.version ?? '—'} · protocolo {a.protocolVersion ?? '—'}
                    </td>
                    <td data-label="Estado">
                      <StatusBadge status={a.status} tone={resourceStatusTone(a.status)} />
                    </td>
                    <td data-label="Visto" className="muted">
                      {relativeTime(a.lastSeenAt)}
                    </td>
                    <td data-label="Ações">
                      {can('agents.revoke') && a.status !== 'revoked' && (
                        <button className="btn ghost" disabled={busyId !== null} onClick={() => revoke(a)} type="button">
                          {busy ? '…' : 'Revogar'}
                        </button>
                      )}
                      {a.status === 'revoked' && <span className="badge neutral">revogado</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
