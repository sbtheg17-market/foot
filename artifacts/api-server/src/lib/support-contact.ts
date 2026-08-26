/**
 * Pilot support contact (docs/pilot/support-workflow.md).
 *
 * Env-configured with a documented placeholder fallback:
 *   1. SUPPORT_CONTACT_URL   — full http(s) link (form, help desk) — wins.
 *   2. SUPPORT_CONTACT_EMAIL — rendered as a mailto: link.
 *   3. Neither set           — pilot placeholder mailto:support@foot.app,
 *      flagged isPlaceholder so operators can spot unconfigured deploys.
 *
 * Same posture as CANCELLATION_NOTICE_HOURS / TRAVEL_SETUP_BUFFER_MINUTES:
 * an INVALID override throws — never a silent fallback.
 */

export const SUPPORT_CONTACT_PLACEHOLDER_EMAIL = "support@foot.app";

export class InvalidSupportContactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSupportContactError";
  }
}

export interface SupportContact {
  url: string;
  label: string;
  isPlaceholder: boolean;
}

export function getSupportContact(): SupportContact {
  const urlOverride = process.env["SUPPORT_CONTACT_URL"]?.trim();
  if (urlOverride) {
    if (!/^https?:\/\/\S+$/i.test(urlOverride)) {
      throw new InvalidSupportContactError(
        `SUPPORT_CONTACT_URL must be an http(s) URL; got "${urlOverride}".`,
      );
    }
    return { url: urlOverride, label: "Contact support", isPlaceholder: false };
  }

  const email = process.env["SUPPORT_CONTACT_EMAIL"]?.trim();
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new InvalidSupportContactError(
        `SUPPORT_CONTACT_EMAIL must be a valid email address; got "${email}".`,
      );
    }
    return { url: `mailto:${email}`, label: email, isPlaceholder: false };
  }

  return {
    url: `mailto:${SUPPORT_CONTACT_PLACEHOLDER_EMAIL}`,
    label: SUPPORT_CONTACT_PLACEHOLDER_EMAIL,
    isPlaceholder: true,
  };
}
