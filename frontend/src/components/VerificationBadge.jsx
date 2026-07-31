import { ShieldCheck, ShieldAlert, ShieldOff, Shield } from "lucide-react";

const CONFIG = {
  draft: { icon: Shield, label: "Verification pending", tone: "muted" },
  pending_review: { icon: ShieldAlert, label: "Under review", tone: "amber" },
  approved: { icon: ShieldCheck, label: "Verified provider", tone: "primary" },
  rejected: { icon: ShieldOff, label: "Verification rejected", tone: "danger" },
  suspended: { icon: ShieldOff, label: "Suspended", tone: "danger" },
};

const TONE_CLASSES = {
  muted: "bg-white/15 text-white",
  amber: "bg-amber-500/20 text-amber-50",
  primary: "bg-white text-primary",
  danger: "bg-red-500/20 text-red-50",
};

export const VerificationBadge = ({ status }) => {
  const cfg = CONFIG[status] || CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLASSES[cfg.tone]}`}
      data-testid={`verification-badge-${status}`}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
};
