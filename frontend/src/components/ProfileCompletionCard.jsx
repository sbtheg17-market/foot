import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

const Ring = ({ percent, size = 72, stroke = 8 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  const offset = c - (p / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90" data-testid="profile-completion-ring">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="hsl(var(--primary))"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        fill="none"
        style={{ transition: "stroke-dashoffset 500ms ease" }}
      />
    </svg>
  );
};

export const ProfileCompletionCard = ({ completion }) => {
  if (!completion) return null;
  const { percent, done, total, missing = [] } = completion;
  const complete = percent >= 100;

  return (
    <section
      className="rounded-2xl bg-card border border-black/5 p-5"
      data-testid="profile-completion-card"
    >
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Ring percent={percent} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold tracking-tight text-foreground" data-testid="profile-completion-percent">
              {percent}%
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Setup progress
          </p>
          <h3 className="text-lg font-bold tracking-tight text-foreground leading-snug">
            {complete ? "Profile complete" : `${done} of ${total} done`}
          </h3>
          <p className="text-sm text-muted-foreground">
            {complete ? "Everything's ready for bookings." : "Finish the last steps to feel booking-ready."}
          </p>
        </div>
      </div>

      {!complete && missing.length > 0 && (
        <ul className="mt-4 space-y-1" data-testid="profile-completion-missing">
          {missing.slice(0, 3).map((m) => (
            <li key={m.key}>
              <Link
                to={m.route}
                className="flex items-center justify-between gap-3 py-2 -mx-1 px-1 rounded-lg hover:bg-muted transition-colors"
                data-testid={`profile-completion-missing-${m.key}`}
              >
                <span className="text-sm text-foreground">{m.label}</span>
                <ArrowRight size={16} className="text-muted-foreground shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {complete && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-sm font-semibold">
          <Check size={14} /> Ready for bookings
        </div>
      )}
    </section>
  );
};
