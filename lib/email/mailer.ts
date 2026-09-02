import nodemailer from "nodemailer";

// SMTP transport for actually sending the compiled pitch email. Config comes
// from env only — nothing here is committed. If SMTP_* isn't set the send
// route reports a clear "not configured" error instead of throwing.

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export function readSmtpConfig(): SmtpConfig | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE } =
    process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return null;
  }

  return {
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE ? SMTP_SECURE === "true" : Number(SMTP_PORT) === 465,
    user: SMTP_USER,
    pass: SMTP_PASS,
    from: SMTP_FROM,
  };
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string;
}

export async function sendPitchEmail(
  config: SmtpConfig,
  email: OutgoingEmail
): Promise<{ messageId: string }> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });

  const info = await transport.sendMail({
    from: config.from,
    to: email.to,
    subject: email.subject,
    text: email.body,
  });

  return { messageId: info.messageId };
}
