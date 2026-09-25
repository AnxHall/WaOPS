'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { resourceStatusTone } from '@/lib/status';

function statusBadgeClass(status: string): string {
  const tone = resourceStatusTone(status);
  return `badge ${tone}`;
}

interface Host {
  id: string;
  name: string;
  status: string;
  osType: string | null;
  environment: string | null;
}

export default function HostsPage() {
  const [hosts, setHosts] = useState<Host[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<Host[]>('/api/v1/hosts')
      .then(setHosts)
      .catch((e) => setError(e instanceof Error ? e.message : 'erro'));
  }, []);

  useEffect(load, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/v1/hosts', { method: 'POST', body: JSON.stringify({ name }) });
      setName('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao criar host');
    }
  }

  return (
    <>
      <h1 className="page-title">Hosts</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={create} style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="Nome do host"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={1}
          />
          <button className="btn primary" type="submit">
            Adicionar
          </button>
        </form>
        {error && <p style={{ color: 'var(--status-critical)', fontSize: 13 }}>{error}</p>}
      </div>

      {error && (
        <div className="card state-error" role="alert" style={{ marginBottom: 16 }}>
          <strong>Erro ao carregar hosts</strong>
          <span className="muted">{error}</span>
          <button className="btn ghost" onClick={load} type="button">
            Tentar novamente
          </button>
        </div>
      )}

      <div className="card">
        {hosts === null ? (
          <div className="skeleton" style={{ height: 160 }} />
        ) : hosts.length === 0 ? (
          <div className="empty">
            <div className="icon" aria-hidden>🖥️</div>
            <strong>Nenhum host</strong>
            <span className="muted">Adicione o primeiro host</span>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Nome</th>
                <th>OS</th>
                <th>Ambiente</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {hosts.map((h) => (
                <tr key={h.id}>
                  <td data-label="Nome">
                    <Link href={`/hosts/${h.id}`}>{h.name}</Link>
                  </td>
                  <td data-label="OS" className="muted">{h.osType ?? '—'}</td>
                  <td data-label="Ambiente" className="muted">{h.environment ?? '—'}</td>
                  <td data-label="Estado">
                    <span className={statusBadgeClass(h.status)}>{h.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
