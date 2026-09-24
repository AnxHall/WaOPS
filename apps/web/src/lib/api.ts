'use client';

/**
 * API client. Access token em memória (nunca localStorage — segurança),
 * refresh via cookie httpOnly no endpoint /auth/refresh.
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

async function refresh(): Promise<boolean> {
  const res = await fetch(`${API}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!res.ok) return false;
  accessToken = res.headers.get('x-access-token');
  return Boolean(accessToken);
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401 && retry) {
    const ok = await refresh();
    if (ok) return api<T>(path, init, false);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body as { error?: { code?: string; message?: string } };
    throw new ApiError(err.error?.code ?? 'internal_error', err.error?.message ?? res.statusText, res.status);
  }
  return body as T;
}

export { API };
