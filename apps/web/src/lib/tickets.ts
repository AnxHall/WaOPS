'use client';

/**
 * WaSupport tickets — shared semantics for the web UI (HM05 follow-up).
 * TRANSITIONS mirrors the API state machine (apps/api/src/support/tickets.controller.ts):
 * open → in_progress → resolved → closed, reopen from resolved/closed; terminal = closed.
 * O backend continua a autoridade — o map aqui só orienta UX (desabilitar/ocultar ações).
 */

export interface Ticket {
  id: string;
  number: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  requesterId: string;
  assigneeId: string | null;
  incidentId: string | null;
  labels: string[];
  openSince: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  comments?: TicketComment[];
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TRANSITIONS: Record<string, readonly string[]> = {
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['resolved', 'closed', 'open'],
  resolved: ['closed', 'open'],
  closed: ['open'],
};

export function nextStatuses(status: string): readonly string[] {
  return TRANSITIONS[status] ?? [];
}

/** Rótulo canônico da transição (pt-BR, mesmo vocabulário das telas). */
export function transitionLabel(target: string): string {
  switch (target) {
    case 'in_progress':
      return 'Iniciar';
    case 'resolved':
      return 'Resolver';
    case 'closed':
      return 'Fechar';
    case 'open':
      return 'Reabrir';
    default:
      return target;
  }
}
