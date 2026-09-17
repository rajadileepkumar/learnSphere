import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhookSignature(secret: string, rawBody: Buffer, header: string | string[] | undefined): boolean {
  if (!header || Array.isArray(header)) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const expectedBuf = Buffer.from(expected);
  const headerBuf = Buffer.from(header);
  if (expectedBuf.length !== headerBuf.length) return false;
  return timingSafeEqual(expectedBuf, headerBuf);
}
