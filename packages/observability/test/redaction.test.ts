import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { createLogger } from '../src/index.js';

/**
 * §42 — Log secret scan. pino `redact` must censor credentials wherever they
 * appear in structured fields; a leaked enrollment token / refresh token /
 * agent credential in a log line defeats the storage-side hashing.
 */
function captureLine(fn: (log: ReturnType<typeof createLogger>) => void): Record<string, unknown> {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });
  const log = createLogger({ level: 'info', name: 'redaction-test', destination: sink });
  fn(log);
  sink.end();
  return JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
}

describe('log secret redaction (§42)', () => {
  it('redacts top-level credential fields', () => {
    const out = captureLine((log) =>
      log.info({ password: 'SuperSecret123!', token: 'evt_abc', secret: 'whsec_x' }, 'auth attempt'),
    );
    expect(out.password).toBe('[REDACTED]');
    expect(out.token).toBe('[REDACTED]');
    expect(out.secret).toBe('[REDACTED]');
  });

  it('redacts nested credential fields', () => {
    const out = captureLine((log) =>
      log.info(
        {
          enrollment: { enrollment_token: 'enr_raw_value' },
          agent: { agent_credential: 'agt_raw_value' },
          session: { refresh_token: 'rt_raw_value' },
        },
        'audit',
      ),
    );
    const enrollment = out.enrollment as Record<string, unknown>;
    const agent = out.agent as Record<string, unknown>;
    const session = out.session as Record<string, unknown>;
    expect(enrollment.enrollment_token).toBe('[REDACTED]');
    expect(agent.agent_credential).toBe('[REDACTED]');
    expect(session.refresh_token).toBe('[REDACTED]');
  });

  it('redacts request header credentials two levels deep', () => {
    const out = captureLine((log) =>
      log.info({ req: { headers: { authorization: 'Bearer abc', cookie: 'waops_refresh=x' } } }, 'http'),
    );
    const req = out.req as { headers: Record<string, unknown> };
    expect(req.headers.authorization).toBe('[REDACTED]');
    expect(req.headers.cookie).toBe('[REDACTED]');
  });

  it('does not redact benign fields with similar names', () => {
    const out = captureLine((log) => log.info({ tokenCount: 3, secrets_enabled: true }, 'metrics'));
    expect(out.tokenCount).toBe(3);
    expect(out.secrets_enabled).toBe(true);
  });
});
