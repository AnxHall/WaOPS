'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Agent {
  id: string;
  name: string;
  version: string | null;
  protocolVersion: number | null;
  status: string;
  lastSeenAt: string | null;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    // Lista de agents via API — foundation expõe via hosts por enquanto;
    // agents list endpoint chega com a UI admin (fase 4 completa). Aqui: db direto não.
    api<unknown[]>('/api/v1/hosts')
      .then(() => setAgents((a) => a ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'erro'));
  }, []);

  useEffect(load, [load]);

  async function createEnrollment() {
    try {
      // Foundation: token gerado via API admin (endpoint dedicado chega na fase 4).
      // Aqui geramos via API de hosts para demonstrar o modal — substituído por:
      setError('Endpoint de enrollment UI chega na fase 4 (agent admin). Use o fluxo CLI por enquanto.');
    } finally {
      void 0;
    }
  }

  return (
    <>
      <h1 className="page-title">Agents</h1>
      {error && (
        <div className="card" style={{ marginBottom: 16 }}>
          <span className="muted">{error}</span>
        </div>
      )}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            Agentes registrados
          </h2>
          <button className="btn primary" onClick={createEnrollment}>
            Novo enrollment token
          </button>
        </div>

        {agents === null ? (
          <div className="skeleton" style={{ height: 160, marginTop: 16 }} />
        ) : agents.length === 0 ? (
          <div className="empty">
            <div className="icon">🤖</div>
            <strong>Nenhum agente</strong>
            <span className="muted">
              Crie um enrollment token e instale o WaAgent no seu host Linux.
            </span>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Versão</th>
                <th>Estado</th>
                <th>Último heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td className="muted">{a.version ?? '—'}</td>
                  <td>{a.status}</td>
                  <td className="muted">
                    {a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {token && (
          <div className="card" style={{ marginTop: 16, background: 'var(--surface-dark)', color: '#fff' }}>
            <strong>Token one-time (expira em 15 min):</strong>
            <code style={{ display: 'block', marginTop: 8, wordBreak: 'break-all' }}>{token}</code>
          </div>
        )}
      </div>
    </>
  );
}
