import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";

export type SendMailInput = {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: Attachment[];
};

function readSmtpConfig() {
  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.office365.com",
    port: Number.parseInt(process.env.SMTP_PORT?.trim() || "587", 10),
    user: process.env.SMTP_USER?.trim() || "",
    password: process.env.SMTP_PASSWORD?.trim() || "",
    from: process.env.SMTP_FROM?.trim() || "",
  };
}

export function isEmailConfigured(): boolean {
  const config = readSmtpConfig();
  return Boolean(config.user && config.password && config.from);
}

let transport: nodemailer.Transporter | null = null;

function getTransport() {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_USER, SMTP_PASSWORD, and SMTP_FROM in .env.",
    );
  }

  if (!transport) {
    const config = readSmtpConfig();
    transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      requireTLS: true,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }

  return transport;
}

export async function sendMail(
  input: SendMailInput & { fromName?: string },
): Promise<void> {
  const config = readSmtpConfig();
  const fromAddress = input.fromName
    ? `"${input.fromName.replace(/"/g, "")}" <${config.from}>`
    : config.from;

  await getTransport().sendMail({
    from: fromAddress,
    to: input.to,
    cc: input.cc?.trim() || undefined,
    replyTo: input.replyTo?.trim() || undefined,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });
}

export function parseEmailList(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
