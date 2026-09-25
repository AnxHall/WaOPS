import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionProvider } from '../src/lib/permissions';
import { PermissionDeniedState, ModuleLockedState, UnavailableData } from '../src/components/states';

afterEach(cleanup);

function renderWith(perms: string[], ui: React.ReactNode) {
  return render(<SessionProvider me={{ user_id: 'u1', tenant_id: 't1', organization_scope: null, permissions: perms }}>{ui}</SessionProvider>);
}

describe('permission UX (backend is the boundary; UI only gates affordances)', () => {
  it('operator with incidents.ack sees acknowledge affordance', async () => {
    const { useSession } = await import('../src/lib/permissions');
    function Probe() {
      const { can } = useSession();
      return <button type="button">{can('incidents.ack') ? 'Reconhecer' : 'Sem permissão'}</button>;
    }
    renderWith(['incidents.read', 'incidents.ack'], <Probe />);
    expect(screen.getByRole('button', { name: 'Reconhecer' })).toBeInTheDocument();
  });

  it('viewer without incidents.ack does NOT see the action', async () => {
    const { useSession } = await import('../src/lib/permissions');
    function Probe() {
      const { can } = useSession();
      return <button type="button">{can('incidents.ack') ? 'Reconhecer' : 'Sem permissão'}</button>;
    }
    renderWith(['incidents.read'], <Probe />);
    expect(screen.getByRole('button', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reconhecer' })).not.toBeInTheDocument();
  });
});

describe('canonical states', () => {
  it('permission denied state explains and offers no bypass', () => {
    renderWith([], <PermissionDeniedState what="detalhes de hosts" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Você não tem acesso a detalhes de hosts');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('module locked state labels the module as not contracted', () => {
    renderWith([], <ModuleLockedState module="WaMonitor" feature="host_monitoring" />);
    expect(screen.getByText('Módulo não contratado')).toBeInTheDocument();
    expect(screen.getByText('Fale com o administrador da conta para contratar.')).toBeInTheDocument();
  });

  it('unavailable data block names the GAP-RM id instead of faking data', () => {
    render(<UnavailableData label="CPU" gapId="GAP-RM-004" />);
    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('Indisponível')).toBeInTheDocument();
    expect(screen.getByTitle('Sem read-model no Alpha atual (GAP-RM-004)')).toBeInTheDocument();
  });
});
