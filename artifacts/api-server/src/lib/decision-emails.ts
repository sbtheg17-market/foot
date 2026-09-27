import { logger } from "./logger.js";

/**
 * Applicant decision emails via Emergent's managed transactional email proxy.
 *
 * Rules (see docs/neo plan, Phase 2 slice 3):
 *  - Recipient and body come from server-side records + fixed templates only;
 *    callers pass a decision, never markup or an address (no open relay).
 *  - `from_name` is this app's own brand from EMAIL_FROM_NAME (never hardcoded).
 *  - The structural gate below runs on every send: no forms/inputs, no
 *    credential asks, https-only links to our own app.
 *  - Sending never throws: the caller gets `{ sent, reason }` so the admin UI can
 *    say honestly whether the applicant was emailed.
 */

// Constant on purpose — survives deployment; do not read from env.
const EMAIL_BASE_URL = "https://integrations.emergentagent.com";

const CRED_ASK = [
  "reply with your password", "reply with the code", "send your password", "cvv",
  "send us your password", "enter your password below", "confirm your card number",
  "your full card number", "seed phrase", "recovery phrase", "verify your card",
  "social security number", "confirm your bank details",
];
const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly"];

export function assertSafeEmail(subject: string, html: string): void {
  if (/<\s*(form|input|textarea|select)\b/i.test(html)) {
    throw new Error("No forms or input fields in email (G2)");
  }
  const body = `${subject}\n${html}`.toLowerCase();
  for (const phrase of CRED_ASK) {
    if (body.includes(phrase)) throw new Error(`Email asks for credentials: ${phrase} (G2)`);
  }
  const urlRe = /\b(?:href|src)\s*=\s*["']([^"']*)["']/gi;
  for (const m of html.matchAll(urlRe)) {
    const url = (m[1] ?? "").trim().toLowerCase();
    if (/^(mailto:|tel:|cid:|#)/.test(url)) continue;
    if (!url.startsWith("https://")) throw new Error(`Email links must be absolute https: ${url} (G3)`);
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (!host || host.includes("xn--") || /^[\d.]+$/.test(host) || host.includes(":") || parsed.username) {
      throw new Error(`Unsafe email link host: ${url} (G3)`);
    }
    if (SHORTENERS.some((s) => host === s || host.endsWith(`.${s}`))) {
      throw new Error(`Shortened URL not allowed: ${url} (G3)`);
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailOutcome =
  | { sent: true; id: string | null }
  | { sent: false; reason: "not_configured" | "rejected_by_gate" | "provider_error" | "invalid_recipient" };

function emailConfig(): { key: string; fromName: string; replyTo: string | undefined } | null {
  const key = process.env["EMERGENT_EMAIL_KEY"]?.trim();
  const fromName = process.env["EMAIL_FROM_NAME"]?.trim();
  if (!key || !fromName) return null;
  return { key, fromName, replyTo: process.env["EMAIL_REPLY_TO"]?.trim() || undefined };
}

/** Absolute https link to the provider's status page, or null when PUBLIC_APP_URL is unset/insecure. */
function statusPageLink(): string | null {
  const base = process.env["PUBLIC_APP_URL"]?.trim().replace(/\/+$/, "");
  if (!base || !base.startsWith("https://")) return null;
  return `${base}/provider/application-status`;
}

export function isEmailConfigured(): boolean {
  return emailConfig() !== null;
}

export interface DecisionEmailInput {
  to: string;
  firstName: string;
  decision: "approved" | "rejected";
  /** Provider-visible reason (rejections only). Reviewer-private notes are NEVER passed here. */
  rejectionReason: string | null;
}

export function renderDecisionEmail(input: DecisionEmailInput, fromName: string): { subject: string; html: string } {
  const name = escapeHtml(input.firstName || "there");
  const brand = escapeHtml(fromName);
  const link = statusPageLink();
  const where = link
    ? `<a href="${link}" style="color:#1f5f4a">your application status page</a>`
    : `your application status page (sign in to ${brand})`;
  const subject = input.decision === "approved"
    ? `Your ${fromName} provider application was approved`
    : `Your ${fromName} provider application decision`;
  const main = input.decision === "approved"
    ? `<p>Good news — your provider application was <strong>approved</strong>.</p>
       <p>Next step: your credentials are reviewed separately. Once your profile verification is approved you can take bookings. Track progress on ${where}.</p>`
    : `<p>Your provider application was reviewed and <strong>not approved</strong> this time.</p>
       <p><strong>Reason from the reviewer:</strong></p>
       <blockquote style="margin:0;padding:12px 16px;border-left:4px solid #ccc;background:#f7f7f5">${escapeHtml(input.rejectionReason ?? "No reason was recorded.")}</blockquote>
       <p>You can fix what was raised and resubmit from ${where}.</p>`;
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222">
<p>Hi ${name},</p>
${main}
<p style="margin-top:24px;font-size:12px;color:#888">Sent by ${brand}. We never ask for your password or payment details by email.</p>
</td></tr></table>`;
  return { subject, html };
}

export async function sendApplicationDecisionEmail(input: DecisionEmailInput): Promise<EmailOutcome> {
  const config = emailConfig();
  if (!config) {
    logger.info({ event: "decision_email_skipped", reason: "not_configured" }, "decision email not configured");
    return { sent: false, reason: "not_configured" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) {
    return { sent: false, reason: "invalid_recipient" };
  }
  const { subject, html } = renderDecisionEmail(input, config.fromName);
  try {
    assertSafeEmail(subject, html);
  } catch (err) {
    logger.error({ err }, "decision email rejected by guardrail gate");
    return { sent: false, reason: "rejected_by_gate" };
  }
  const payload: Record<string, unknown> = {
    to: [input.to],
    subject,
    html,
    from_name: config.fromName,
  };
  if (config.replyTo) payload["contact_email"] = config.replyTo;
  try {
    const resp = await fetch(`${EMAIL_BASE_URL}/api/v1/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Email-Key": config.key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      logger.error({ status: resp.status, body: text.slice(0, 300) }, "decision email send failed");
      return { sent: false, reason: "provider_error" };
    }
    const json = (await resp.json().catch(() => ({}))) as { id?: unknown };
    const id = typeof json.id === "string" ? json.id : null;
    logger.info({ event: "decision_email_sent", decision: input.decision, emailId: id }, "decision email sent");
    return { sent: true, id };
  } catch (err) {
    logger.error({ err }, "decision email send error");
    return { sent: false, reason: "provider_error" };
  }
}
