'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, setAccessToken, API } from '@/lib/api';
import { SessionProvider, type Me } from '@/lib/permissions';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/agents', label: 'Agents' },
  { href: '/hosts', label: 'Hosts' },
];

// Módulos comerciais (module registry) — locked sem entitlement (designer.md §7)
const MODULE_NAV = [
  { label: 'WaSupport' },
  { label: 'Wantry' },
  { label: 'WaDatabase' },
  { label: 'WaBackup' },
  { label: 'WaKnowledge' },
  { label: 'WaNotify' },
  { label: 'WaAI' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // tenta refresh silencioso ao carregar
    fetch(`${API}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const token = res.headers.get('x-access-token');
        if (token) setAccessToken(token);
        const m = await api<Me>('/api/v1/auth/me');
        if (!cancelled) setMe(m);
      })
      .catch(() => {
        if (!cancelled) setFatal(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    await fetch(`${API}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' });
    setAccessToken(null);
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="auth-wrap" role="status" aria-label="Carregando sessão">
        <div className="skeleton" style={{ width: 320, height: 24 }} />
      </div>
    );
  }

  if (fatal) {
    return (
      <div className="auth-wrap">
        <div className="card state-error" role="alert">
          <div className="state-icon" aria-hidden>
            ✕
          </div>
          <strong>Não foi possível conectar à API</strong>
          <span className="muted">Verifique se os serviços WaOPS estão no ar.</span>
          <button className="btn ghost" onClick={() => router.refresh()} type="button">
            Tentar novamente
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              setAccessToken(null);
              router.push('/login');
            }}
            type="button"
          >
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <SessionProvider me={me}>
      <div className="layout">
        <aside className="sidebar">
          <div className="logo">
            Wa<span>OPS</span>
          </div>
          <nav aria-label="Navegação principal">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${pathname === item.href || pathname.startsWith(`${item.href}/`) ? ' active' : ''}`}
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                {pathname === item.href && <span className="dot" aria-hidden />}
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="nav-section">Módulos</div>
          {MODULE_NAV.map((m) => (
            <span key={m.label} className="nav-item" title="Módulo não contratado">
              <span aria-hidden>🔒</span>
              <span className="nav-label">{m.label}</span>
            </span>
          ))}
          <div className="nav-footer" style={{ marginTop: 'auto' }}>
            <span className="nav-item" title={me?.tenant_id}>
              <span aria-hidden>👤</span>
              <span className="nav-label">{me?.user_id.slice(0, 8)}…</span>
            </span>
            <button
              className="nav-item"
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={logout}
              type="button"
            >
              <span aria-hidden>⏻</span>
              <span className="nav-label">Sair</span>
            </button>
          </div>
        </aside>
        <div className="main">
          <header className="header">
            <div style={{ fontWeight: 600 }}>WaOPS</div>
            <div className="muted">tenant {me?.tenant_id.slice(0, 8)}…</div>
          </header>
          {children}
        </div>
      </div>
    </SessionProvider>
  );
}
