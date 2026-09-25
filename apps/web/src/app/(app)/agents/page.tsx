'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/permissions';
import { ErrorState, ModuleLockedState, UnavailableData } from '@/components/states';

/**
 * Agents — read-model de listagem de agentes NÃO existe no Alpha (GAP-RM-005):
 * não há `GET /api/v1/agents` nem endpoint admin de enrollment tokens.
 * A tela é honesta: EmptyState declarando o gap + bloco indisponível.
 * Nenhum mock, nenhum endpoint temporário (regra da 02.5).
 * Alvo: HARD MISSION 03 — WaMonitor (surface admin de agents).
 */
export default function AgentsPage() {
  const { can } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [probed, setProbed] = useState<boolean | null>(null);

  // Probe de permissão/sessão: valida apenas que o contexto responde (auth ok).
  useEffect(() => {
    api<unknown>('/api/v1/auth/me')
      .then(() => setProbed(true))
      .catch((e) => setError(e instanceof Error ? e.message : 'erro'));
  }, []);

  if (error) {
    return (
      <>
        <h1 className="page-title">Agents</h1>
        <ErrorState message="Erro ao verificar sessão" detail={error} onRetry={() => window.location.reload()} />
      </>
    );
  }

  if (probed === null) {
    return (
      <>
        <h1 className="page-title">Agents</h1>
        <div className="skeleton" style={{ height: 160 }} />
      </>
    );
  }

  if (!can('agents.read')) {
    return (
      <>
        <h1 className="page-title">Agents</h1>
        <ModuleLockedState module="Agents" feature="agents.read" />
      </>
    );
  }

  return (
    <>
      <h1 className="page-title">Agents</h1>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            Agentes registrados
          </h2>
          <span className="badge neutral" title="GAP-RM-005">
            Read-model ausente
          </span>
        </div>

        <div className="empty">
          <div className="icon" aria-hidden>
            🤖
          </div>
          <strong>Listagem de agentes indisponível no Alpha</strong>
          <span className="muted">
            O endpoint <code>GET /api/v1/agents</code> e a criação de enrollment tokens via UI
            chegam na HARD MISSION 03 (GAP-RM-005). Use o fluxo de enrollment via API do gateway.
          </span>
        </div>

        <UnavailableData
          label="Enrollment token via UI"
          gapId="GAP-RM-005"
          reason="Endpoint admin de tokens ausente no Alpha"
        />
      </div>
    </>
  );
}
