'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setAccessToken, API } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        await api('/api/v1/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, tenantName }),
        });
      }
      const loginRes = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!loginRes.ok) {
        const body = await loginRes.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? 'Falha no login');
      }
      const token = loginRes.headers.get('x-access-token');
      if (token) setAccessToken(token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
          Wa<span style={{ color: 'var(--brand-primary)' }}>OPS</span>
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {mode === 'login' ? 'Acesse sua conta' : 'Crie sua conta e tenant'}
        </p>

        {mode === 'signup' && (
          <input
            className="input"
            placeholder="Nome do tenant"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            required
            minLength={2}
          />
        )}
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === 'signup' ? 10 : 1}
        />

        {error && (
          <div role="alert" style={{ color: 'var(--status-critical)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button className="btn primary" disabled={loading} type="submit">
          {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <button
          type="button"
          className="btn ghost"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? 'Criar nova conta' : 'Já tenho conta'}
        </button>
      </form>
    </div>
  );
}
