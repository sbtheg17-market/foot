import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createReview, getBookingReview } from "../lib/api";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Star, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function ReviewForm({ bookingId, providerName }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const existingQ = useQuery({
    queryKey: ["review", bookingId],
    queryFn: () => getBookingReview(bookingId),
  });

  const mut = useMutation({
    mutationFn: () => createReview({ booking_id: bookingId, rating, comment }),
    onSuccess: () => {
      toast.success("Thanks for the review!");
      qc.invalidateQueries({ queryKey: ["review", bookingId] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e?.response?.data?.detail || e.message),
  });

  if (existingQ.data?.review) {
    return (
      <div data-testid={`review-existing-${bookingId}`} className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
        You rated {existingQ.data.review.rating}/5
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`review-open-${bookingId}`} className="rounded-full h-9">
          <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Leave a review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader><DialogTitle>How was {providerName}?</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Your rating</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  data-testid={`review-star-${n}`}
                  onClick={() => setRating(n)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star className={`h-8 w-8 ${n <= rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Comment (optional)</label>
            <Textarea data-testid={`review-comment-${bookingId}`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What stood out?" className="mt-1 rounded-xl" rows={4} />
          </div>
          <Button data-testid={`review-submit-${bookingId}`} onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full h-11 rounded-full bg-primary">
            {mut.isPending ? "Sending…" : "Submit review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
