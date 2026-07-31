import { Star, ShieldCheck } from "lucide-react";
import { useReviews, useReviewsSummary } from "./hooks";

const StarRow = ({ value, size = 14 }) => {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= full || (i === full + 1 && half);
        return (
          <Star
            key={i}
            size={size}
            strokeWidth={2}
            className={filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}
          />
        );
      })}
    </div>
  );
};

const BreakdownBar = ({ stars, count, total }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1" data-testid={`review-breakdown-${stars}`}>
      <span className="text-xs font-semibold text-muted-foreground w-6">{stars}★</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-amber-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
    </div>
  );
};

const _relative = (iso) => {
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
};

const ReviewCard = ({ review }) => (
  <article
    className="rounded-2xl bg-card border border-black/5 p-5"
    data-testid={`review-card-${review.id}`}
  >
    <div className="flex items-start justify-between mb-2 gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-foreground truncate">{review.client_name}</p>
        <p className="text-xs text-muted-foreground">{_relative(review.created_at)}</p>
      </div>
      <StarRow value={review.rating} />
    </div>
    {review.comment && (
      <p className="text-sm text-foreground leading-relaxed">{review.comment}</p>
    )}
    {review.is_verified && (
      <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary" data-testid={`review-verified-${review.id}`}>
        <ShieldCheck size={12} />
        Verified from OnCall Foot booking
      </div>
    )}
  </article>
);

export default function ReviewsPage() {
  const { data: reviews, isLoading: reviewsLoading } = useReviews();
  const { data: summary, isLoading: summaryLoading } = useReviewsSummary();
  const loading = reviewsLoading || summaryLoading;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Trust</p>
        <h1 className="text-lg font-bold tracking-tight text-foreground">Reviews</h1>
      </header>

      <main className="px-5 py-6 space-y-6" data-testid="reviews-page">
        {loading && (
          <div className="rounded-2xl bg-card border border-black/5 h-40 animate-pulse" />
        )}

        {!loading && summary && summary.count === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 flex flex-col items-start gap-4" data-testid="reviews-empty">
            <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-primary">
              <Star size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground mb-1">No reviews yet</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Verified client reviews will appear here once you complete bookings. Load demo bookings from the Profile page to see the flow.
              </p>
            </div>
          </div>
        )}

        {!loading && summary && summary.count > 0 && (
          <>
            <section className="rounded-2xl bg-card border border-black/5 p-6" data-testid="reviews-hero">
              <div className="flex items-center gap-5">
                <div>
                  <p className="text-4xl font-bold tracking-tight text-foreground" data-testid="reviews-average">
                    {summary.average.toFixed(1)}
                  </p>
                  <StarRow value={summary.average} size={16} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.count} {summary.count === 1 ? "review" : "reviews"}
                  </p>
                </div>
                <div className="flex-1 min-w-0" data-testid="reviews-breakdown">
                  {[5, 4, 3, 2, 1].map((s) => (
                    <BreakdownBar
                      key={s}
                      stars={s}
                      count={summary.breakdown?.[s] || 0}
                      total={summary.count}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-3" data-testid="reviews-list">
              {(reviews || []).map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </section>
          </>
        )}
      </main>
    </>
  );
}
