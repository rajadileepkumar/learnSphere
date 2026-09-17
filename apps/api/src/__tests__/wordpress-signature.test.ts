import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from '../modules/wordpress/signature.js';

const SECRET = 'test-secret';

function sign(body: string) {
  return `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
}

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed body', () => {
    const body = Buffer.from(JSON.stringify({ id: '1' }));
    expect(verifyWebhookSignature(SECRET, body, sign(body.toString()))).toBe(true);
  });

  it('rejects a tampered body', () => {
    const signed = sign(JSON.stringify({ id: '1' }));
    const tampered = Buffer.from(JSON.stringify({ id: '2' }));
    expect(verifyWebhookSignature(SECRET, tampered, signed)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(verifyWebhookSignature(SECRET, Buffer.from('{}'), undefined)).toBe(false);
  });

  it('rejects the wrong secret', () => {
    const body = Buffer.from(JSON.stringify({ id: '1' }));
    const wrongSecret = `sha256=${createHmac('sha256', 'other-secret').update(body).digest('hex')}`;
    expect(verifyWebhookSignature(SECRET, body, wrongSecret)).toBe(false);
  });
});
