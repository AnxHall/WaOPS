import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from '../src/notifications.js';

const SECRET = 'whsec_test_123';
const BODY = JSON.stringify({ incident_id: 'inc_1', event: { event_id: 'evt_1' } });
const DELIVERY = 'dlv_1';
const NOW = 1_800_000_000;

function sign(ts: string, delivery: string, body: string): string {
  return createHmac('sha256', SECRET).update(`${ts}.${delivery}.${body}`).digest('hex');
}

describe('webhook signature verification (receiver reference)', () => {
  it('accepts a valid signature', () => {
    const ts = NOW.toString();
    const result = verifyWebhookSignature({
      secret: SECRET,
      signature: sign(ts, DELIVERY, BODY),
      timestamp: ts,
      deliveryId: DELIVERY,
      body: BODY,
      nowSeconds: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects replayed timestamp beyond tolerance', () => {
    const ts = (NOW - 601).toString(); // tolerance 300s
    const result = verifyWebhookSignature({
      secret: SECRET,
      signature: sign(ts, DELIVERY, BODY),
      timestamp: ts,
      deliveryId: DELIVERY,
      body: BODY,
      nowSeconds: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('rejects tampered body', () => {
    const ts = NOW.toString();
    const result = verifyWebhookSignature({
      secret: SECRET,
      signature: sign(ts, DELIVERY, BODY),
      timestamp: ts,
      deliveryId: DELIVERY,
      body: BODY.replace('evt_1', 'evt_2'),
      nowSeconds: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('mismatch');
  });

  it('rejects wrong delivery id (signature binding)', () => {
    const ts = NOW.toString();
    const result = verifyWebhookSignature({
      secret: SECRET,
      signature: sign(ts, 'dlv_other', BODY),
      timestamp: ts,
      deliveryId: DELIVERY,
      body: BODY,
      nowSeconds: NOW,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects malformed timestamp', () => {
    const result = verifyWebhookSignature({
      secret: SECRET,
      signature: 'deadbeef'.repeat(4),
      timestamp: 'not-a-number',
      deliveryId: DELIVERY,
      body: BODY,
      nowSeconds: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('bad_timestamp');
  });

  it('rejects wrong secret', () => {
    const ts = NOW.toString();
    const result = verifyWebhookSignature({
      secret: 'whsec_other',
      signature: sign(ts, DELIVERY, BODY),
      timestamp: ts,
      deliveryId: DELIVERY,
      body: BODY,
      nowSeconds: NOW,
    });
    expect(result.ok).toBe(false);
  });
});
