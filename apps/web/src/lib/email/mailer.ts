import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * App-owned transactional email via the project's own SMTP mailbox.
 * We send auth emails (welcome, password reset) ourselves rather than relying
 * on Supabase's rate-limited built-in mailer. Keep this server-only — it reads
 * SMTP credentials that must never reach the client bundle.
 */

let cached: Transporter | null = null;

function getTransport(): Transporter {
  if (cached) return cached;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS must be set to send email');
  }

  cached = nodemailer.createTransport({
    host,
    port,
    // Port 465 = implicit TLS (SSL). Anything else (587/25) = STARTTLS.
    secure: port === 465,
    auth: { user, pass },
  });
  return cached;
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail({ to, subject, html, text }: SendMailInput): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  await getTransport().sendMail({ from, to, subject, html, text });
}
