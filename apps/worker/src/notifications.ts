import nodemailer, { type Transporter } from 'nodemailer';
import { createHmac } from 'node:crypto';
import { getPrisma } from '@waops/db';
import { getCorrelationLogger } from '@waops/observability';
import type { EventEnvelopeV1 } from '@waops/contracts';

/**
 * WaNotify foundation: email (SMTP → Mailpit local) + generic webhook (HMAC
 * signed). Deliveries recorded with attempts; caller handles retries/DLQ.
 */
export class NotificationService {
  private transporter: Transporter | null = null;

  private mailer(): Transporter {
    if (!this.transporter) {
      const host = process.env.SMTP_HOST ?? 'localhost';
      const port = Number(process.env.SMTP_PORT ?? 1025);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
        ...(process.env.SMTP_USER
          ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? '' } }
          : {}),
      });
    }
    return this.transporter;
  }

  async dispatchToChannel(
    channelId: string,
    incidentId: string | null,
    envelope: EventEnvelopeV1,
  ): Promise<{ status: string; error?: string }> {
    const prisma = getPrisma();
    const logger = getCorrelationLogger();
    const channel = await prisma.notificationChannel.findUnique({ where: { id: channelId } });
    if (!channel || !channel.enabled) return { status: 'skipped' };

    const delivery = await prisma.notificationDelivery.create({
      data: {
        tenantId: envelope.tenant_id,
        channelId,
        incidentId: incidentId ?? envelope.resource_id ?? null,
        status: 'pending',
      },
    });

    try {
      if (channel.provider === 'email') {
        const config = channel.configJson as { to: string };
        const subject = `[WaOPS ${envelope.severity}] ${envelope.event_type}`;
        const body = [
          `Event: ${envelope.event_type}`,
          `Severity: ${envelope.severity}`,
          `Tenant: ${envelope.tenant_id}`,
          `Resource: ${envelope.resource_id ?? 'n/a'}`,
          `Event ID: ${envelope.event_id}`,
          `Observed at: ${envelope.observed_at}`,
          JSON.stringify(envelope.attributes, null, 2),
        ].join('\n');
        const info = await this.mailer().sendMail({
          from: process.env.SMTP_FROM ?? 'waops@localhost',
          to: config.to,
          subject,
          text: body,
        });
        await prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'delivered',
            providerMessageRef: info.messageId,
            attemptCount: { increment: 1 },
          },
        });
        return { status: 'delivered' };
      }

      if (channel.provider === 'webhook') {
        const config = channel.configJson as { url: string; secret?: string };
        const payload = JSON.stringify({ incident_id: incidentId, event: envelope });
        const signature = config.secret
          ? createHmac('sha256', config.secret).update(payload).digest('hex')
          : undefined;
        const res = await fetch(config.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(signature ? { 'x-waops-signature': `sha256=${signature}` } : {}),
          },
          body: payload,
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`webhook responded ${res.status}`);
        await prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { status: 'delivered', attemptCount: { increment: 1 } },
        });
        return { status: 'delivered' };
      }

      logger.warn({ provider: channel.provider }, 'unknown notification provider');
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'failed', lastError: 'unknown provider', attemptCount: { increment: 1 } },
      });
      return { status: 'failed', error: 'unknown provider' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'failed', lastError: message, attemptCount: { increment: 1 } },
      });
      return { status: 'failed', error: message };
    }
  }
}
