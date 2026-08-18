/**
 * Validates an email address using standard RFC 5322 regex.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  
  // Standard RFC 5322 simplified email validation regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * Trims, lowercases, validates, and deduplicates an array of recipient email addresses.
 */
export function sanitizeRecipients(recipients: string[]): { validRecipients: string[]; invalidRecipients: string[] } {
  const validRecipients: string[] = [];
  const invalidRecipients: string[] = [];
  const seen = new Set<string>();

  for (const raw of recipients) {
    if (typeof raw !== 'string') {
      invalidRecipients.push(String(raw));
      continue;
    }
    const normalized = raw.trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      invalidRecipients.push(raw);
    } else if (!seen.has(normalized)) {
      seen.add(normalized);
      validRecipients.push(normalized);
    }
  }

  return { validRecipients, invalidRecipients };
}
