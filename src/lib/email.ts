import nodemailer, { type Transporter } from 'nodemailer';

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; messageIds: string[] }
  | { ok: false; error: string };

let transporter: Transporter | null = null;

function getTransporter(host: string, port: number, user: string, pass: string): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return transporter;
}

/** Server-only: never import from a client component (uses SMTP credentials). */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.EMAIL_FROM || user;
  if (!host || !user || !pass || !fromEmail) {
    return { ok: false, error: 'Email is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS)' };
  }

  try {
    const info = await getTransporter(host, port, user, pass).sendMail({
      from: { address: fromEmail, name: process.env.EMAIL_FROM_NAME || 'InvoiceMudah' },
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    return { ok: true, messageIds: [info.messageId] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
