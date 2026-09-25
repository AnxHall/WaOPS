'use client';

/**
 * Estados canônicos de UI (designer.md §7 / UI_STATE_MATRIX.md).
 * Componentes derivados dos patterns do designer.md — sem segunda linguagem visual.
 */
import { badgeClass, resourceStatusTone, toneGlyph, type StatusTone } from '../lib/status';

/** Loading — skeleton (nunca spinner central em tela cheia). */
export function Skeleton({ h = 16, w }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w }} />;
}

/** Empty — ícone em círculo subtle, título, 1 linha, CTA da ação que resolve. */
export function EmptyState({
  icon = '∅',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="icon" aria-hidden>
        {icon}
      </div>
      <strong>{title}</strong>
      {description && <span className="muted">{description}</span>}
      {action}
    </div>
  );
}

/** Error — card com ícone crítico, mensagem de operador, "Tentar novamente". */
export function ErrorState({
  message,
  detail,
  onRetry,
}: {
  message: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card state-error" role="alert">
      <div className="state-icon" aria-hidden>
        ✕
      </div>
      <strong>{message}</strong>
      {detail && (
        <details className="state-detail">
          <summary>Detalhe técnico</summary>
          <code>{detail}</code>
        </details>
      )}
      {onRetry && (
        <button className="btn ghost" onClick={onRetry} type="button">
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/** Permission denied — cadeado, sem CTA de bypass (designer.md §7). */
export function PermissionDeniedState({ what }: { what: string }) {
  return (
    <div className="card state-locked" role="alert">
      <div className="state-icon" aria-hidden>
        🔒
      </div>
      <strong>Você não tem acesso a {what}</strong>
      <span className="muted">Peça acesso a um administrador do tenant.</span>
    </div>
  );
}

/** Module locked — preview esmaecido, badge, CTA "Falar com o administrador". */
export function ModuleLockedState({ module: moduleName, feature }: { module: string; feature?: string }) {
  return (
    <div className="card state-module" aria-label={`Módulo não contratado: ${moduleName}`}>
      <div className="state-icon" aria-hidden>
        🔒
      </div>
      <strong>{moduleName}</strong>
      <span className="badge neutral">Módulo não contratado</span>
      {feature && <span className="muted">Recurso: {feature}</span>}
      <span className="muted">Fale com o administrador da conta para contratar.</span>
    </div>
  );
}

/**
 * Dado indisponível por gap de read-model (GAP-RM-*) — honesto, nunca mock.
 * Mostra o motivo e mantém o card no layout (partial/degraded do §7).
 */
export function UnavailableData({
  label,
  gapId,
  reason = 'Sem read-model no Alpha atual',
}: {
  label: string;
  gapId?: string;
  reason?: string;
}) {
  return (
    <div className="unavailable" title={gapId ? `${reason} (${gapId})` : reason}>
      <span className="unavailable-label">{label}</span>
      <span className="badge neutral">
        <span aria-hidden>{toneGlyph('neutral')}</span> Indisponível
      </span>
      <span className="muted">{reason}</span>
    </div>
  );
}

/** Stale — banner fino com dot warning + recarregar (designer.md §7). */
export function StaleBanner({ asOf, onReload }: { asOf: string; onReload?: () => void }) {
  return (
    <div className="stale-banner" role="status">
      <span className="stale-dot" aria-hidden />
      <span>
        Dados de {new Date(asOf).toLocaleString('pt-BR')} — atualização pausada
      </span>
      {onReload && (
        <button className="btn ghost" onClick={onReload} type="button">
          Recarregar
        </button>
      )}
    </div>
  );
}

/** Badge canônico: dot/ícone + label textual (nunca cor sozinha). */
export function StatusBadge({ status, tone }: { status: string; tone?: StatusTone }) {
  const t = tone ?? resourceStatusTone(status);
  return (
    <span className={badgeClass(t)}>
      <span aria-hidden>{toneGlyph(t)}</span>
      {status}
    </span>
  );
}
