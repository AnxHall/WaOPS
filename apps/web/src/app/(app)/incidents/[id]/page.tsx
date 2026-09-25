'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/permissions';
import { incidentStatusTone, severityTone, relativeTime } from '@/lib/status';
import {
  ErrorState,
  PermissionDeniedState,
  Skeleton,
  StatusBadge,
} from '@/components/states';

/**
 * Incident Detail (SCREEN_MAP /incidents/:id) — dados REAIS.
 * Ações acknowledge/resolve com proteção de double-submit e atualização de UI
 * somente com o estado confirmado pelo servidor (resposta do POST).
 * Métrica relacionada = GAP-RM-008 (read-model ausente — estado honesto).
 */

export interface IncidentDetail {
  id: string;
  title: string;
  severity: string;
  status: string;
  primaryResourceId: string | null;
  fingerprint: string | null;
  detectedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

interface TimelineEntry {
  id: string;
  entryType: string;
  actorType: string;
  actorId: string | null;
  payloadJson: unknown;
  createdAt: string;
}

const OPEN_STATUSES = new Set(['detected', 'acknowledged']);

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { can } = useSession();

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'acknowledge' | 'resolve' | null>(null); // double-submit guard

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api<IncidentDetail>(`/api/v1/incidents/${id}`),
      api<TimelineEntry[]>(`/api/v1/incidents/${id}/timeline`),
    ])
      .then(([i, t]) => {
        setIncident(i);
        setTimeline(t);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  async function act(action: 'acknowledge' | 'resolve') {
    if (!incident || busy) return; // double-submit protection
    setBusy(action);
    setActionError(null);
    try {
      const updated = await api<IncidentDetail>(`/api/v1/incidents/${incident.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ note: `${action} via UI` }),
      });
      // UI reflete SOMENTE o estado confirmado pelo servidor:
      setIncident(updated);
      setTimeline(await api<TimelineEntry[]>(`/api/v1/incidents/${incident.id}/timeline`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setActionError('O incidente mudou de estado. Atualizando…');
        load(); // estado do servidor vence
      } else {
        setActionError(err instanceof Error ? err.message : 'Falha na ação');
      }
    } finally {
      setBusy(null);
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
        <h1 className="page-title">Incidente não encontrado</h1>
        <ErrorState
          message="Incidente não encontrado"
          detail="O incidente não existe neste tenant ou o ID pertence a outro tenant."
          onRetry={load}
        />
      </>
    );
  }

  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return (
      <>
        <h1 className="page-title">Incidents</h1>
        <PermissionDeniedState what="incidentes (incidents.read)" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 className="page-title">Incidente</h1>
        <ErrorState message="Erro ao carregar incidente" detail={error.message} onRetry={load} />
      </>
    );
  }

  if (!incident) return null;

  const isOpen = OPEN_STATUSES.has(incident.status);

  return (
    <>
      <nav className="muted" aria-label="Trilha de navegação">
        <Link href="/incidents">Incidents</Link> / {incident.title}
      </nav>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {incident.title}
        <StatusBadge status={incident.severity} tone={severityTone(incident.severity)} />
        <StatusBadge status={incident.status} tone={incidentStatusTone(incident.status)} />
      </h1>

      {actionError && (
        <div className="card" role="alert" style={{ marginBottom: 16, color: 'var(--status-critical)' }}>
          {actionError}
        </div>
      )}

      <div className="grid cols-2">
        <section className="card" aria-labelledby="id-detail">
          <h2 className="card-title" id="id-detail">
            Detalhe
          </h2>
          <dl className="kv">
            <div>
              <dt>Severidade</dt>
              <dd>
                <StatusBadge status={incident.severity} tone={severityTone(incident.severity)} />
              </dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <StatusBadge status={incident.status} tone={incidentStatusTone(incident.status)} />
              </dd>
            </div>
            <div>
              <dt>Recurso afetado</dt>
              <dd>
                {incident.primaryResourceId ? (
                  <span className="mono-id" title={incident.primaryResourceId}>
                    {incident.primaryResourceId.slice(0, 18)}…
                  </span>
                ) : (
                  '—'
                )}
                <span className="muted"> (resolução de nome: GAP-RM-007)</span>
              </dd>
            </div>
            <div>
              <dt>Detectado</dt>
              <dd title={incident.detectedAt}>{relativeTime(incident.detectedAt)}</dd>
            </div>
            <div>
              <dt>Reconhecido</dt>
              <dd>{incident.acknowledgedAt ? new Date(incident.acknowledgedAt).toLocaleString('pt-BR') : '—'}</dd>
            </div>
            <div>
              <dt>Resolvido</dt>
              <dd>{incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString('pt-BR') : '—'}</dd>
            </div>
            {incident.fingerprint && (
              <div>
                <dt>Fingerprint</dt>
                <dd className="mono-id" title={incident.fingerprint}>
                  {incident.fingerprint.slice(0, 24)}…
                </dd>
              </div>
            )}
          </dl>

          {can('incidents.ack') && incident.status === 'detected' && (
            <button className="btn primary" onClick={() => act('acknowledge')} disabled={busy !== null} type="button">
              {busy === 'acknowledge' ? 'Reconhecendo…' : 'Reconhecer'}
            </button>
          )}
          {can('incidents.resolve') && isOpen && (
            <button
              className="btn ghost"
              onClick={() => act('resolve')}
              disabled={busy !== null}
              type="button"
              style={{ marginLeft: 8 }}
            >
              {busy === 'resolve' ? 'Resolvendo…' : 'Resolver'}
            </button>
          )}
          {!can('incidents.ack') && !can('incidents.resolve') && isOpen && (
            <p className="muted" style={{ marginBottom: 0 }}>
              Sem permissão para ações neste incidente (incidents.ack / incidents.resolve).
            </p>
          )}
        </section>

        <section className="card" aria-labelledby="id-timeline">
          <h2 className="card-title" id="id-timeline">
            Timeline
          </h2>
          {timeline === null ? (
            <Skeleton h={120} />
          ) : timeline.length === 0 ? (
            <p className="muted">Sem entradas de timeline.</p>
          ) : (
            <div className="timeline">
              {timeline.map((t) => (
                <div className="timeline-entry" key={t.id}>
                  <div className="timeline-icon" aria-hidden>
                    {t.entryType === 'resolved'
                      ? '✓'
                      : t.entryType === 'acknowledged'
                        ? '👁'
                        : t.entryType === 'reopened'
                          ? '↺'
                          : '•'}
                  </div>
                  <div>
                    <div className="muted mono-id">
                      {new Date(t.createdAt).toLocaleString('pt-BR')}
                    </div>
                    <div>
                      {t.entryType} <span className="muted">({t.actorType})</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="id-metric">
          <h2 className="card-title" id="id-metric">
            Métrica relacionada
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Série do fingerprint que disparou o incidente.
          </p>
          <div className="unavailable">
            <span className="unavailable-label">Série temporal</span>
            <span className="badge neutral">Indisponível</span>
            <span className="muted">
              Sem read-model de métricas no Alpha (alvo: HARD MISSION 03 — WaMonitor).
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
