import { createHash, timingSafeEqual } from 'node:crypto';
import { getPrisma } from '@waops/db';

export interface AgentIdentity {
  agentId: string;
  tenantId: string;
}

/**
 * Agent authentication — tenant scope is derived from the stored agent
 * identity, NEVER from payload fields (WAAGENT_PROTOCOL_V1.md Credentials).
 * Credential format: waops_<agentId>_<secret>; stored as sha256(secret) salted
 * with agent id (durable credential issued at enrollment).
 */
export function hashAgentCredential(agentId: string, secret: string): string {
  return createHash('sha256').update(`${agentId}:${secret}`).digest('hex');
}

export function parseCredentialHeader(header: string | undefined): { agentId: string; secret: string } | null {
  if (!header?.startsWith('Bearer ')) return null;
  const raw = header.slice('Bearer '.length).trim();
  const parts = raw.split('_');
  if (parts.length !== 3 || parts[0] !== 'waops') return null;
  const agentId = parts[1];
  const secret = parts[2];
  if (!agentId || !secret) return null;
  return { agentId, secret };
}

export async function authenticateAgent(header: string | undefined): Promise<AgentIdentity | null> {
  const parsed = parseCredentialHeader(header);
  if (!parsed) return null;
  const prisma = getPrisma();
  const agent = await prisma.agent.findUnique({ where: { id: parsed.agentId } });
  if (!agent || agent.status === 'revoked') return null;
  if (!agent.credentialHash) return null;

  const candidate = hashAgentCredential(agent.id, parsed.secret);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(agent.credentialHash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { agentId: agent.id, tenantId: agent.tenantId };
}
