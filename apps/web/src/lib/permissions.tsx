'use client';

import { createContext, useContext } from 'react';

export interface Me {
  user_id: string;
  tenant_id: string;
  organization_scope: string | null;
  permissions: string[];
  request_id?: string;
}

/**
 * Sessão para UX (esconder/desabilitar ações). Backend continua sendo a
 * authorization boundary — esconder botão NUNCA é segurança
 * (frontend-architecture.md; ADR-006: tenant só do token).
 */
const SessionContext = createContext<{ me: Me | null }>({ me: null });

export function SessionProvider({
  me,
  children,
}: {
  me: Me | null;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={{ me }}>{children}</SessionContext.Provider>;
}

export function useSession(): {
  me: Me | null;
  can: (permission: string) => boolean;
} {
  const { me } = useContext(SessionContext);
  const set = new Set(me?.permissions ?? []);
  return { me, can: (p: string) => set.has(p) };
}

export function usePermissions(): { can: (permission: string) => boolean; size: number } {
  const set = new Set(useContext(SessionContext).me?.permissions ?? []);
  return { can: (p: string) => set.has(p), size: set.size };
}
