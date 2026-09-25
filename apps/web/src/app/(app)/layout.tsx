'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, setAccessToken, API } from '@/lib/api';

interface Me {
  user_id: string;
  tenant_id: string;
  permissions: string[];
}

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

  useEffect(() => {
    // tenta refresh silencioso ao carregar
    fetch(`${API}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const token = res.headers.get('x-access-token');
        if (token) setAccessToken(token);
        const m = await api<Me>('/api/v1/auth/me');
        setMe(m);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await fetch(`${API}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' });
    setAccessToken(null);
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="auth-wrap">
        <div className="skeleton" style={{ width: 320, height: 24 }} />
      </div>
    );
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          Wa<span>OPS</span>
        </div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${pathname === item.href ? ' active' : ''}`}
          >
            {pathname === item.href && <span className="dot" />}
            {item.label}
          </Link>
        ))}
        <div className="nav-section">Módulos</div>
        {MODULE_NAV.map((m) => (
          <span key={m.label} className="nav-item" title="Módulo não contratado">
            🔒 {m.label}
          </span>
        ))}
        <div style={{ marginTop: 'auto' }}>
          <span className="nav-item" title={me?.tenant_id}>
            {me?.permissions.includes('tenants.read') ? '👤' : '👤'} {me?.user_id.slice(0, 8)}…
          </span>
          <button className="nav-item" style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }} onClick={logout}>
            Sair
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
  );
}
