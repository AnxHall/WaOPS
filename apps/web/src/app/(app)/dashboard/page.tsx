'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSession } from '@/lib/permissions';
import { useRealtime } from '@/lib/use-realtime';

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  detectedAt: string;
}

interface RateLimitStats {
  window_seconds: number;
  classes: { routeClass: string; windowStart: string; limited: number }[];
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
  const { can } = useSession();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [hosts, setHosts] = useState<Host[] | null>(null);
  const [agentsOnline, setAgentsOnline] = useState<number | null>(null); // GAP-RM-006 closed
  const [rlStats, setRlStats] = useState<RateLimitStats | null>(null); // 429/min (HM05 follow-up)
  const [error, setError] = useState<string | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [i, h, a, rl] = await Promise.all([
        api<Incident[]>('/api/v1/incidents'),
        api<Host[]>('/api/v1/hosts'),
        api<{ status: string }[]>('/api/v1/agents').catch(() => null),
        // Métrica de rate limiting (Redis como fonte) — opcional: falha/403 não derruba o dashboard.
        api<RateLimitStats>('/api/v1/rate-limits').catch(() => null),
      ]);
      setIncidents(i);
      setHosts(h);
      if (a) setAgentsOnline(a.filter((x) => x.status === 'online').length);
      setRlStats(rl);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    }
  }, []);

  useEffect(() => {
    void load();
    // Safety-net poll: SSE carries freshness; this bounds staleness to 30s if
    // an event is ever missed (stream is at-least-once, not exactly-once).
    const poll = setInterval(() => void load(), 30_000);
    return () => {
      clearInterval(poll);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [load]);

  // ADR-010: realtime replaces aggressive polling — incident/agent events
  // trigger a debounced refetch of the affected read models.
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => void load(), 400);
  }, [load]);

  const realtimeStatus = useRealtime({
    'incident.created': scheduleReload,
    'incident.updated': scheduleReload,
    'agent.heartbeat': scheduleReload,
    'agent.revoked': scheduleReload,
  });

  const liveBadge =
    realtimeStatus === 'open'
      ? { cls: 'badge ok', label: 'live' }
      : realtimeStatus === 'reconnecting' || realtimeStatus === 'connecting'
        ? { cls: 'badge warning', label: 'reconectando…' }
        : realtimeStatus === 'unauthorized'
          ? { cls: 'badge critical', label: 'sessão expirada' }
          : { cls: 'badge neutral', label: 'offline' };

  const openIncidents = incidents?.filter((i) => i.status !== 'resolved' && i.status !== 'closed') ?? [];
  const onlineHosts = hosts?.filter((h) => h.status === 'online') ?? [];

  return (
    <>
      <h1 className="page-title">
        Dashboard{' '}<span className={liveBadge.cls} title={`realtime: ${realtimeStatus}`}>{liveBadge.label}</span>
      </h1>

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
          <p className="kpi-value">{agentsOnline === null ? '—' : agentsOnline}</p>
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
        {can('tenants.read') && (
          <div className="card">
            <h2 className="card-title">Rate limiting — 429/min (Redis)</h2>
            {rlStats === null ? (
              <div className="skeleton" style={{ height: 96 }} />
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Classe de rota</th>
                    <th>Limitados (janela 60s)</th>
                  </tr>
                </thead>
                <tbody>
                  {rlStats.classes.map((c) => (
                    <tr key={c.routeClass}>
                      <td data-label="Classe">{c.routeClass}</td>
                      <td data-label="Limitados">
                        {c.limited > 0 ? (
                          <span className="badge warning">▲ {c.limited}</span>
                        ) : (
                          <span className="muted">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Fonte: contadores Redis do token bucket (auth/api/realtime).
            </p>
          </div>
        )}
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
