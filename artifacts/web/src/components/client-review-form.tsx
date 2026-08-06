import { useState } from 'react';
import { Star } from 'lucide-react';
import { useCreateReview } from '@workspace/api-client-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type ExistingReview = {
  rating: number;
  comment?: string | null;
};

export default function ClientReviewForm({
  bookingId,
  existingReview,
  onSubmitted,
}: {
  bookingId: number;
  existingReview?: ExistingReview;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? '');
  const [validationError, setValidationError] = useState('');
  const createReview = useCreateReview();

  if (existingReview) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-semibold">Your review</h2>
          <div className="flex items-center gap-0.5" aria-label={`${existingReview.rating} out of 5 stars`}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={`h-4 w-4 ${index < existingReview.rating ? 'fill-accent text-accent' : 'text-muted'}`}
              />
            ))}
          </div>
        </div>
        {existingReview.comment && (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{existingReview.comment}</p>
        )}
        <p className="mt-3 text-xs text-primary">Thanks for helping other clients choose with confidence.</p>
      </div>
    );
  }

  const handleSubmit = () => {
    const trimmedComment = comment.trim();
    if (!rating) {
      setValidationError('Choose a rating from 1 to 5 stars.');
      return;
    }
    if (trimmedComment.length > 1000) {
      setValidationError('Keep your comment to 1,000 characters or fewer.');
      return;
    }

    setValidationError('');
    createReview.mutate(
      {
        data: {
          bookingId,
          rating,
          ...(trimmedComment ? { comment: trimmedComment } : {}),
        },
      },
      {
        onSuccess: onSubmitted,
        onError: (error) => {
          const status = (error as { status?: number }).status;
          setValidationError(
            status === 409
              ? 'A review for this visit already exists. Refreshing your booking.'
              : status === 400
                ? 'Check your rating and comment, then try again.'
                : 'We could not save your review. Please try again.',
          );
        },
      },
    );
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-serif text-xl font-semibold">How was your visit?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your experience helps other clients find the right care.
      </p>
      <div className="mt-4 flex gap-2" role="radiogroup" aria-label="Rating">
        {Array.from({ length: 5 }).map((_, index) => {
          const value = index + 1;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              aria-checked={rating === value}
              role="radio"
            >
              <Star className={`h-6 w-6 ${value <= rating ? 'fill-accent text-accent' : 'text-muted-foreground'}`} />
            </button>
          );
        })}
      </div>
      <label htmlFor={`review-comment-${bookingId}`} className="mt-4 block text-sm font-semibold">
        Comment <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Textarea
        id={`review-comment-${bookingId}`}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={1000}
        placeholder="Share a helpful note about your visit"
        className="mt-2 min-h-24 resize-none"
      />
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{validationError || 'Keep it kind and specific.'}</span>
        <span>{comment.length}/1000</span>
      </div>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={createReview.isPending}
        className="mt-4 min-h-11 w-full"
      >
        {createReview.isPending ? 'Saving review…' : 'Submit review'}
      </Button>
    </section>
  );
}