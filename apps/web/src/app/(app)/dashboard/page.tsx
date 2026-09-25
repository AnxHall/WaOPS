'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  detectedAt: string;
}

interface Host {
  id: string;
  name: string;
  status: string;
  osType: string | null;
}

function severityBadgeClass(severity: string): string {
  if (severity === 'critical') return 'badge critical';
  if (severity === 'high') return 'badge warning';
  if (severity === 'warning') return 'badge warning';
  return 'badge info';
}

function statusBadgeClass(status: string): string {
  if (status === 'online' || status === 'resolved' || status === 'active') return 'badge ok';
  if (status === 'detected' || status === 'acknowledged') return 'badge critical';
  if (status === 'pending') return 'badge info';
  return 'badge neutral';
}

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [hosts, setHosts] = useState<Host[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Incident[]>('/api/v1/incidents'), api<Host[]>('/api/v1/hosts')])
      .then(([i, h]) => {
        setIncidents(i);
        setHosts(h);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'));
  }, []);

  const openIncidents = incidents?.filter((i) => i.status !== 'resolved' && i.status !== 'closed') ?? [];
  const onlineHosts = hosts?.filter((h) => h.status === 'online') ?? [];

  return (
    <>
      <h1 className="page-title">Dashboard</h1>

      {error && (
        <div className="card" role="alert" style={{ marginBottom: 16, color: 'var(--status-critical)' }}>
          Erro ao carregar dados: {error}
        </div>
      )}

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="kpi-label">Incidentes abertos</div>
          <p className="kpi-value">{incidents === null ? '—' : openIncidents.length}</p>
        </div>
        <div className="card">
          <div className="kpi-label">Hosts online</div>
          <p className="kpi-value">{hosts === null ? '—' : `${onlineHosts.length}/${hosts.length}`}</p>
        </div>
        <div className="card">
          <div className="kpi-label">Agentes conectados</div>
          <p className="kpi-value" title="GAP-RM-006: read-model de agents ausente no Alpha">
            —
          </p>
        </div>
        <div className="card" style={{ background: 'linear-gradient(135deg, #e86a2e, #f7b79b)', color: '#fff' }}>
          <div className="kpi-label" style={{ color: 'rgba(255,255,255,.8)' }}>
            Disponibilidade
          </div>
          <p className="kpi-value" style={{ color: '#fff' }}>
            {hosts && hosts.length > 0
              ? `${Math.round((onlineHosts.length / hosts.length) * 100)}%`
              : '—'}
          </p>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2 className="card-title">Incidentes recentes</h2>
          {incidents === null ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : incidents.length === 0 ? (
            <div className="empty">
              <div className="icon">✓</div>
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
                </tr>
              </thead>
              <tbody>
                {incidents.slice(0, 5).map((i) => (
                  <tr key={i.id}>
                    <td data-label="Severidade">
                      <span className={severityBadgeClass(i.severity)}>
                        <span className="dot" aria-hidden />
                        {i.severity}
                      </span>
                    </td>
                    <td data-label="Título">
                      <Link href={`/incidents/${i.id}`}>{i.title}</Link>
                    </td>
                    <td data-label="Estado">
                      <span className={statusBadgeClass(i.status)}>{i.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ marginTop: 12 }}>
            <Link href="/incidents" className="muted">
              Ver todos →
            </Link>
          </p>
        </div>

        <div className="card">
          <h2 className="card-title">Hosts</h2>
          {hosts === null ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : hosts.length === 0 ? (
            <div className="empty">
              <div className="icon">＋</div>
              <strong>Nenhum host</strong>
              <span className="muted">Adicione seu primeiro agente para começar</span>
              <Link href="/agents" className="btn primary" style={{ marginTop: 8 }}>
                Adicionar agente
              </Link>
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>OS</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {hosts.slice(0, 5).map((h) => (
                  <tr key={h.id}>
                    <td data-label="Nome">
                      <Link href={`/hosts/${h.id}`}>{h.name}</Link>
                    </td>
                    <td data-label="OS" className="muted">{h.osType ?? '—'}</td>
                    <td data-label="Estado">
                      <span className={statusBadgeClass(h.status)}>{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
