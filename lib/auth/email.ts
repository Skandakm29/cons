import nodemailer, { type Transporter } from "nodemailer";
import { APP_NAME, BUSINESS_RULES } from "@/lib/config";

type Env = Record<string, string | undefined>;

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends transactional email. SMTP covers Gmail, Resend, Brevo, Zoho, SES, … */
export interface EmailSender {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

export class MockEmailSender implements EmailSender {
  readonly name = "mock";
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    console.info(`[email:mock] to ${message.to}: ${message.subject}\n${message.text}`);
  }
}

export class SmtpEmailSender implements EmailSender {
  readonly name = "smtp";
  constructor(
    private readonly transport: Pick<Transporter, "sendMail">,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

function requireEnv(env: Env, name: string): string {
  const v = env[name];
  if (!v) throw new Error(`${name} must be set when EMAIL_PROVIDER=smtp`);
  return v;
}

export function getEmailSender(env: Env = process.env): EmailSender {
  switch (env.EMAIL_PROVIDER ?? "mock") {
    case "mock":
      return new MockEmailSender();
    case "smtp": {
      const user = requireEnv(env, "SMTP_USER");
      const port = Number(env.SMTP_PORT ?? 465);
      const transport = nodemailer.createTransport({
        host: requireEnv(env, "SMTP_HOST"),
        port,
        secure: port === 465,
        auth: { user, pass: requireEnv(env, "SMTP_PASS") },
      });
      return new SmtpEmailSender(transport, env.EMAIL_FROM || `${APP_NAME} <${user}>`);
    }
    default:
      throw new Error(`Unknown EMAIL_PROVIDER "${env.EMAIL_PROVIDER}"`);
  }
}

export function otpEmail(to: string, code: string): EmailMessage {
  const minutes = BUSINESS_RULES.otpTtlMinutes;
  return {
    to,
    subject: `${code} is your ${APP_NAME} login code`,
    text: `Your ${APP_NAME} login code is ${code}.\n\nIt expires in ${minutes} minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;color:#1e293b">
  <p style="font-size:18px;font-weight:700;color:#b8410c;margin:0 0 16px">${APP_NAME}</p>
  <p style="margin:0 0 8px">Your login code is</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px">${code}</p>
  <p style="color:#64748b;font-size:14px;margin:0">It expires in ${minutes} minutes. If you didn't ask for it, you can ignore this email.</p>
</div>`,
  };
}
