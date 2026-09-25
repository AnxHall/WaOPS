'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  detectedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

interface TimelineEntry {
  id: string;
  entryType: string;
  actorType: string;
  createdAt: string;
}

function sevClass(severity: string): string {
  if (severity === 'critical') return 'badge critical';
  if (severity === 'high') return 'badge warning';
  if (severity === 'warning') return 'badge warning';
  return 'badge info';
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Incident[]>('/api/v1/incidents')
      .then(setIncidents)
      .catch((e) => setError(e instanceof Error ? e.message : 'erro'));
  }, []);

  useEffect(load, [load]);

  async function openDetail(incident: Incident) {
    setSelected(incident);
    const tl = await api<TimelineEntry[]>(`/api/v1/incidents/${incident.id}/timeline`);
    setTimeline(tl);
  }

  async function act(incident: Incident, action: 'acknowledge' | 'resolve') {
    await api(`/api/v1/incidents/${incident.id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ note: `${action} via UI` }),
    });
    load();
    setSelected(null);
  }

  return (
    <>
      <h1 className="page-title">Incidents</h1>
      {error && (
        <div className="card" role="alert" style={{ marginBottom: 16, color: 'var(--status-critical)' }}>
          {error}
        </div>
      )}
      <div className="grid cols-2">
        <div className="card">
          <h2 className="card-title">Lista</h2>
          {incidents === null ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : incidents.length === 0 ? (
            <div className="empty">
              <div className="icon">✓</div>
              <strong>Nenhum incidente</strong>
              <span className="muted">Sem incidentes registrados</span>
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Sev</th>
                  <th>Título</th>
                  <th>Estado</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id} onClick={() => openDetail(i)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className={sevClass(i.severity)}>
                        <span className="dot" />
                        {i.severity}
                      </span>
                    </td>
                    <td>{i.title}</td>
                    <td className="muted">{i.status}</td>
                    <td>
                      {i.status === 'detected' && (
                        <button className="btn ghost" onClick={(e) => { e.stopPropagation(); act(i, 'acknowledge'); }}>
                          Ack
                        </button>
                      )}
                      {i.status !== 'resolved' && i.status !== 'closed' && (
                        <button className="btn ghost" onClick={(e) => { e.stopPropagation(); act(i, 'resolve'); }}>
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">{selected ? 'Timeline' : 'Detalhe'}</h2>
          {!selected ? (
            <p className="muted">Selecione um incidente para ver a timeline.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <strong>{selected.title}</strong>
              <span className={`badge ${sevClass(selected.severity).split(' ')[1]}`}>
                {selected.severity} · {selected.status}
              </span>
              {timeline.map((t) => (
                <div key={t.id} style={{ borderLeft: '2px solid var(--border-default)', paddingLeft: 12 }}>
                  <div className="muted">{new Date(t.createdAt).toLocaleString('pt-BR')}</div>
                  <div>
                    {t.entryType} <span className="muted">({t.actorType})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
