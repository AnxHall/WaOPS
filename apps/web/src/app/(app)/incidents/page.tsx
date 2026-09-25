'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/permissions';
import { incidentStatusTone, severityTone, relativeTime } from '@/lib/status';

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  detectedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

function sevClass(severity: string): string {
  return `badge ${severityTone(severity)}`;
}

export default function IncidentsPage() {
  const { can } = useSession();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null); // double-submit guard
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<Incident[]>('/api/v1/incidents')
      .then(setIncidents)
      .catch((e) => setError(e instanceof Error ? e.message : 'erro'));
  }, []);

  useEffect(load, [load]);

  async function act(incident: Incident, action: 'acknowledge' | 'resolve') {
    if (busyId) return; // double-submit protection
    setBusyId(incident.id);
    setActionError(null);
    try {
      await api(`/api/v1/incidents/${incident.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ note: `${action} via UI` }),
      });
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        load(); // estado do servidor vence (já acked/resolvido em outra sessão)
      } else {
        setActionError(err instanceof Error ? err.message : 'Falha na ação');
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h1 className="page-title">Incidents</h1>
      {error && (
        <div className="card state-error" role="alert" style={{ marginBottom: 16 }}>
          <strong>Erro ao carregar incidentes</strong>
          <span className="muted">{error}</span>
          <button className="btn ghost" onClick={load} type="button">
            Tentar novamente
          </button>
        </div>
      )}
      {actionError && (
        <div className="card" role="alert" style={{ marginBottom: 16, color: 'var(--status-critical)' }}>
          {actionError}
        </div>
      )}

      <div className="card">
        {incidents === null ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : incidents.length === 0 ? (
          <div className="empty">
            <div className="icon" aria-hidden>
              ✓
            </div>
            <strong>Nenhum incidente</strong>
            <span className="muted">Tudo operando normalmente</span>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Severidade</th>
                <th>Título</th>
                <th>Estado</th>
                <th>Detectado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => {
                const open = i.status === 'detected' || i.status === 'acknowledged';
                const busy = busyId === i.id;
                return (
                  <tr key={i.id}>
                    <td data-label="Severidade">
                      <span className={sevClass(i.severity)}>
                        <span className="dot" aria-hidden />
                        {i.severity}
                      </span>
                    </td>
                    <td data-label="Título">
                      <Link href={`/incidents/${i.id}`}>{i.title}</Link>
                    </td>
                    <td data-label="Estado">
                      <span className={`badge ${incidentStatusTone(i.status)}`}>{i.status}</span>
                    </td>
                    <td data-label="Detectado" className="muted">
                      {relativeTime(i.detectedAt)}
                    </td>
                    <td data-label="Ações">
                      {can('incidents.ack') && i.status === 'detected' && (
                        <button
                          className="btn ghost"
                          disabled={busyId !== null}
                          onClick={() => act(i, 'acknowledge')}
                          type="button"
                        >
                          {busy ? '…' : 'Ack'}
                        </button>
                      )}
                      {can('incidents.resolve') && open && (
                        <button
                          className="btn ghost"
                          disabled={busyId !== null}
                          onClick={() => act(i, 'resolve')}
                          type="button"
                        >
                          {busy ? '…' : 'Resolve'}
                        </button>
                      )}
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
