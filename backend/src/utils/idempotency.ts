import crypto from 'crypto';

/**
 * Generates a deterministic SHA-256 idempotency key for an email request.
 * 
 * Canonical representation format:
 * `senderId|normalizedRecipient|normalizedSubject|normalizedBody|ISO8601ScheduledAt`
 */
export function generateIdempotencyKey(
  senderId: string,
  recipient: string,
  subject: string,
  body: string,
  scheduledAt: Date
): string {
  const normalizedRecipient = recipient.trim().toLowerCase();
  const normalizedSubject = subject.trim();
  const normalizedBody = body.trim();
  const normalizedScheduledAt = scheduledAt.toISOString();

  const rawKeyString = `${senderId}|${normalizedRecipient}|${normalizedSubject}|${normalizedBody}|${normalizedScheduledAt}`;

  return crypto.createHash('sha256').update(rawKeyString, 'utf8').digest('hex');
}
