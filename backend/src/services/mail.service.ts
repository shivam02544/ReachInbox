import nodemailer, { Transporter } from 'nodemailer';
import { Sender, Email } from '@prisma/client';
import { logger } from '../utils/logger';

export interface SendMailResult {
  messageId: string;
  response: string;
  previewUrl: string | false;
  accepted: string[];
  rejected: string[];
}

const transporterCache = new Map<string, Transporter>();

/**
 * Creates or retrieves a cached Nodemailer transporter for a given Sender's SMTP credentials.
 */
function getTransporterForSender(sender: Sender): Transporter {
  // Key transporter cache by senderId + host + user
  const cacheKey = `${sender.id}:${sender.smtpHost}:${sender.smtpPort}:${sender.smtpUser}`;

  if (transporterCache.has(cacheKey)) {
    return transporterCache.get(cacheKey)!;
  }

  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465, // True for 465, false for 587
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPassword,
    },
    // Reasonable connection timeouts
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
  });

  transporterCache.set(cacheKey, transporter);
  return transporter;
}

/**
 * Sends an email via SMTP using the specific Sender's credentials and retrieves Ethereal preview URL.
 */
export async function sendMailWithSender(sender: Sender, email: Email): Promise<SendMailResult> {
  const transporter = getTransporterForSender(sender);

  const fromAddress = sender.displayName
    ? `"${sender.displayName}" <${sender.email}>`
    : sender.email;

  const mailOptions = {
    from: fromAddress,
    to: email.recipient,
    subject: email.subject,
    text: email.body,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    logger.info(
      'SMTP',
      `[SMTP Sent] Message ID: ${info.messageId} | Recipient: ${email.recipient} | Response: ${info.response}`
    );

    if (previewUrl) {
      logger.info('SMTP', `[Ethereal Preview URL] ${previewUrl}`);
    }

    return {
      messageId: info.messageId,
      response: info.response,
      previewUrl,
      accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : [],
      rejected: Array.isArray(info.rejected) ? info.rejected.map(String) : [],
    };
  } catch (err: any) {
    // Sanitize error message to ensure no credentials or sensitive URIs are leaked
    const rawMsg = err instanceof Error ? err.message : String(err);
    const sanitizedMsg = rawMsg.replace(/pass=([^&\s]+)/gi, 'pass=***');

    logger.error('SMTP', `[SMTP Error] Delivery failed for recipient ${email.recipient}: ${sanitizedMsg}`);
    throw new Error(sanitizedMsg);
  }
}
