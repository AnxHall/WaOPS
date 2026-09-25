'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/permissions';
import { resourceStatusTone, relativeTime } from '@/lib/status';
import {
  ErrorState,
  PermissionDeniedState,
  Skeleton,
  StaleBanner,
  StatusBadge,
  UnavailableData,
} from '@/components/states';

/**
 * Host Detail (SCREEN_MAP /monitor/hosts/:id) — dados REAIS.
 * Telemetria (CPU/memória/load/filesystem/network/containers) tem storage mas
 * NÃO tem read-model HTTP no Alpha: exibida como indisponível com GAP-RM-*
 * (READ_MODEL_GAPS.md). Nenhum endpoint temporário é criado (regra da 02.5).
 */

interface HostDetail {
  id: string;
  name: string;
  osType: string | null;
  osVersion: string | null;
  arch: string | null;
  environment: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function HostDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { can } = useSession();

  const [host, setHost] = useState<HostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api<HostDetail>(`/api/v1/hosts/${id}`)
      .then(setHost)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) {
    return (
      <>
        <nav className="muted" aria-label="Trilha de navegação">
          <Link href="/hosts">Hosts</Link> / {id?.slice(0, 8)}…
        </nav>
        <h1 className="page-title">Carregando…</h1>
        <div className="card">
          <Skeleton h={20} w="40%" />
          <div style={{ height: 16 }} />
          <Skeleton h={14} w="70%" />
          <div style={{ height: 16 }} />
          <Skeleton h={120} />
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

  const agentState: string | null = host.status === 'online' ? 'online' : host.status;

  return (
    <>
      <nav className="muted" aria-label="Trilha de navegação">
        <Link href="/hosts">Hosts</Link> / {host.name}
      </nav>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {host.name} <StatusBadge status={agentState} />
      </h1>

      {host.status !== 'online' && (
        <div className="stale-banner" role="status">
          <span className="stale-dot" aria-hidden />
          <span>
            Agente {agentState === 'offline' ? 'desconectado' : `em estado ${agentState}`} —
            telemetria pode estar desatualizada.
          </span>
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
            <div>
              <dt>ID</dt>
              <dd className="mono-id" title={host.id}>
                {host.id.slice(0, 18)}…
              </dd>
            </div>
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
                  <StatusBadge status={agentState} />
                </dd>
              </div>
              <div>
                <dt>Última atividade</dt>
                <dd>{relativeTime(host.updatedAt)}</dd>
              </div>
            </dl>
          ) : (
            <UnavailableData label="Detalhes do agente" reason="Sem permissão agents.read" />
          )}
        </section>

        <section className="card" aria-labelledby="hd-telemetry">
          <h2 className="card-title" id="hd-telemetry">
            Telemetria
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Coletada pelo WaAgent e persistida, porém sem read-model HTTP no Alpha
            (alvo: HARD MISSION 03 — WaMonitor).
          </p>
          <UnavailableData label="CPU" gapId="GAP-RM-004" />
          <UnavailableData label="Memória" gapId="GAP-RM-004" />
          <UnavailableData label="Load average" gapId="GAP-RM-004" />
        </section>

        <section className="card" aria-labelledby="hd-inventory">
          <h2 className="card-title" id="hd-inventory">
            Inventário
          </h2>
          <UnavailableData
            label="Filesystem (uso por mount)"
            gapId="GAP-RM-001"
            reason="Coletado e persistido; read-model ausente"
          />
          <UnavailableData
            label="Network (interfaces/throughput)"
            gapId="GAP-RM-002"
            reason="Coletado e persistido; read-model ausente"
          />
          <UnavailableData
            label="Containers (estado, imagem, métricas)"
            gapId="GAP-RM-003"
            reason="Coletado; writer de inventário e read-model ausentes"
          />
        </section>
      </div>
    </>
  );
}
