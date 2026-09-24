'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

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

      <div className="card">
        {hosts === null ? (
          <div className="skeleton" style={{ height: 160 }} />
        ) : hosts.length === 0 ? (
          <div className="empty">
            <div className="icon">🖥️</div>
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
                  <td>{h.name}</td>
                  <td className="muted">{h.osType ?? '—'}</td>
                  <td className="muted">{h.environment ?? '—'}</td>
                  <td>{h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
