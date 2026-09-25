'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/permissions';
import { relativeTime } from '@/lib/status';
import { ErrorState, PermissionDeniedState, Skeleton, StatusBadge } from '@/components/states';
import { MetricChartCard, formatBytes, metricUnitKind, type SeriesMap, type SeriesPoint } from '@/components/MetricChartCard';

/**
 * Host Detail (SCREEN_MAP /monitor/hosts/:id) — HM03: telemetria REAL via
 * /hosts/:id/metrics e /hosts/:id/filesystems; containers do inventário
 * (identity bridge). GAPs fechados: GAP-RM-001/002/003/004.
 */

interface HostDetail {
  id: string;
  name: string;
  osType: string | null;
  osVersion: string | null;
  arch: string | null;
  environment: string | null;
  status: string;
  machineId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContainerRow {
  id: string;
  name: string;
  image: string | null;
  state: string;
  health: string | null;
  lastSeenAt: string;
}

interface FsRow {
  mount: string;
  used_bytes: number;
  available_bytes: number;
  observed_at: string;
}

const CHART_DEFS: Array<{ metric: string; title: string }> = [
  { metric: 'host.cpu.usage_percent', title: 'CPU' },
  { metric: 'host.memory.used_bytes', title: 'Memória (usada)' },
  { metric: 'host.load.1', title: 'Load (1min)' },
];

export default function HostDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { can } = useSession();

  const [host, setHost] = useState<HostDetail | null>(null);
  const [series, setSeries] = useState<SeriesMap | null>(null);
  const [filesystems, setFilesystems] = useState<FsRow[] | null>(null);
  const [containers, setContainers] = useState<ContainerRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api<HostDetail>(`/api/v1/hosts/${id}`),
      api<{ series: SeriesMap }>(`/api/v1/hosts/${id}/metrics`).catch(() => null),
      api<{ filesystems: FsRow[] }>(`/api/v1/hosts/${id}/filesystems`).catch(() => null),
    ])
      .then(async ([h, m, fs]) => {
        setHost(h);
        setSeries(m?.series ?? {});
        setFilesystems(fs?.filesystems ?? null);
        if (h.machineId) {
          setContainers(
            await api<ContainerRow[]>(`/api/v1/hosts/${id}/containers`).catch(() => null),
          );
        }
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) {
    return (
      <>
        <nav className="muted" aria-label="Trilha de navegação">
          <Link href="/hosts">Hosts</Link> / …
        </nav>
        <h1 className="page-title">Carregando…</h1>
        <div className="grid cols-2">
          <div className="card">
            <Skeleton h={20} w="40%" />
            <div style={{ height: 16 }} />
            <Skeleton h={120} />
          </div>
          <div className="card">
            <Skeleton h={120} />
          </div>
        </div>
      </>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <>
        <h1 className="page-title">Host não encontrado</h1>
        <ErrorState
          message="Host não encontrado"
          detail="O host não existe neste tenant ou o ID pertence a outro tenant."
          onRetry={load}
        />
      </>
    );
  }

  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return (
      <>
        <h1 className="page-title">Hosts</h1>
        <PermissionDeniedState what="detalhes de hosts (hosts.read)" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 className="page-title">Host</h1>
        <ErrorState message="Erro ao carregar host" detail={error.message} onRetry={load} />
      </>
    );
  }

  if (!host) return null;

  const offline = host.status !== 'online';

  return (
    <>
      <nav className="muted" aria-label="Trilha de navegação">
        <Link href="/hosts">Hosts</Link> / {host.name}
      </nav>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {host.name} <StatusBadge status={host.status} />
      </h1>

      {offline && (
        <div className="stale-banner" role="status">
          <span className="stale-dot" aria-hidden />
          <span>Agente {host.status} — telemetria pode estar desatualizada.</span>
        </div>
      )}

      <div className="grid cols-2">
        <section className="card" aria-labelledby="hd-identity">
          <h2 className="card-title" id="hd-identity">
            Identidade
          </h2>
          <dl className="kv">
            <div>
              <dt>Nome</dt>
              <dd>{host.name}</dd>
            </div>
            <div>
              <dt>OS</dt>
              <dd>
                {host.osType ?? '—'}
                {host.osVersion ? ` ${host.osVersion}` : ''}
              </dd>
            </div>
            <div>
              <dt>Arquitetura</dt>
              <dd>{host.arch ?? '—'}</dd>
            </div>
            <div>
              <dt>Ambiente</dt>
              <dd>{host.environment ?? '—'}</dd>
            </div>
            <div>
              <dt>Criado em</dt>
              <dd>{new Date(host.createdAt).toLocaleString('pt-BR')}</dd>
            </div>
            <div>
              <dt>Atualizado</dt>
              <dd title={host.updatedAt}>{relativeTime(host.updatedAt)}</dd>
            </div>
            {host.machineId && (
              <div>
                <dt>Machine ID</dt>
                <dd className="mono-id" title={host.machineId}>
                  {host.machineId.slice(0, 16)}…
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="card" aria-labelledby="hd-agent">
          <h2 className="card-title" id="hd-agent">
            Agente
          </h2>
          {can('agents.read') ? (
            <dl className="kv">
              <div>
                <dt>Estado</dt>
                <dd>
                  <StatusBadge status={host.status} />
                </dd>
              </div>
              <div>
                <dt>Última atividade</dt>
                <dd>{relativeTime(host.updatedAt)}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Sem permissão agents.read para detalhes do agente.</p>
          )}
        </section>

        {CHART_DEFS.map(({ metric, title }) => (
          <MetricChartCard
            key={metric}
            title={title}
            points={series?.[metric] as SeriesPoint[] | undefined}
            unit={metricUnitKind(metric)}
          />
        ))}

        <section className="card" aria-labelledby="hd-fs">
          <h2 className="card-title" id="hd-fs">
            Filesystems
          </h2>
          {!filesystems ? (
            <p className="muted">Sem read-model no momento (aguardando telemetria).</p>
          ) : filesystems.length === 0 ? (
            <p className="muted">Nenhuma amostra de filesystem na última hora.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Mount</th>
                  <th>Usado</th>
                  <th>Disponível</th>
                </tr>
              </thead>
              <tbody>
                {filesystems.map((f) => (
                  <tr key={f.mount}>
                    <td data-label="Mount" className="mono-id">
                      {f.mount}
                    </td>
                    <td data-label="Usado">{formatBytes(f.used_bytes)}</td>
                    <td data-label="Disponível">{formatBytes(f.available_bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card" aria-labelledby="hd-containers">
          <h2 className="card-title" id="hd-containers">
            Containers
          </h2>
          {!containers ? (
            <p className="muted">Docker ausente no host ou sem inventário ainda.</p>
          ) : containers.length === 0 ? (
            <p className="muted">Nenhum container em execução.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Imagem</th>
                  <th>Estado</th>
                  <th>Visto</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Nome">{c.name}</td>
                    <td data-label="Imagem" className="mono-id">
                      {c.image ?? '—'}
                    </td>
                    <td data-label="Estado">
                      <StatusBadge status={c.state} />
                    </td>
                    <td data-label="Visto" className="muted">
                      {relativeTime(c.lastSeenAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
