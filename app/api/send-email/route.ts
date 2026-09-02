import {
  readSmtpConfig,
  sendPitchEmail,
  type OutgoingEmail,
} from "@/lib/email/mailer";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: Partial<OutgoingEmail>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const to = body.to?.trim() ?? "";
  const subject = body.subject?.trim() ?? "";
  const text = body.body ?? "";

  if (!EMAIL_RE.test(to)) {
    return Response.json(
      { error: "Enter a valid recipient email address." },
      { status: 400 }
    );
  }
  if (!subject || !text.trim()) {
    return Response.json(
      { error: "Subject and body can't be empty." },
      { status: 400 }
    );
  }
  if (/\[\[.+?\]\]/.test(`${subject}\n${text}`)) {
    return Response.json(
      { error: "Fill in every [[merge field]] before sending." },
      { status: 400 }
    );
  }

  const config = readSmtpConfig();
  if (!config) {
    return Response.json(
      {
        error:
          "SMTP isn't configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in .env.local.",
      },
      { status: 503 }
    );
  }

  try {
    const { messageId } = await sendPitchEmail(config, { to, subject, body: text });
    return Response.json({ sent: true, messageId });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to send the email." },
      { status: 502 }
    );
  }
}
