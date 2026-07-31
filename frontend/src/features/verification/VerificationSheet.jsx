import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { api, formatApiErrorDetail } from "../../lib/api";
import { qk } from "../../lib/queryKeys";

export const VerificationSheet = ({ open, onOpenChange, status }) => {
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: async () => (await api.post("/providers/me/verification/submit")).data,
    onSuccess: (user) => {
      qc.setQueryData(qk.auth.me, user);
      qc.invalidateQueries({ queryKey: qk.dashboard.providerSummary });
      qc.invalidateQueries({ queryKey: qk.auth.me });
      toast.success("Submitted for review");
      onOpenChange(false);
    },
    onError: (err) => toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message),
  });

  const already = status === "pending_review" || status === "approved";
  const approved = status === "approved";
  const rejected = status === "rejected";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl p-0 max-h-[85vh] flex flex-col"
        data-testid="verification-sheet"
      >
        <SheetHeader className="px-6 pt-6 pb-2 text-left">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3">
            <ShieldCheck size={22} />
          </div>
          <SheetTitle className="text-2xl font-bold tracking-tight">
            {approved ? "You're verified" : already ? "Review in progress" : "Submit for verification"}
          </SheetTitle>
          <SheetDescription className="text-muted-foreground leading-relaxed">
            {approved
              ? "You're a verified OnCall Foot provider. Clients see your Verified badge."
              : already
              ? "Our team is reviewing your certifications and profile. We'll notify you when it's decided."
              : rejected
              ? "Your previous review didn't go through. Update your certifications and resubmit — we'll take another look."
              : "Once submitted, our team reviews your certifications, profile and coverage. Verified providers get a trust badge that clients see everywhere."}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-4 flex-1 overflow-y-auto space-y-3">
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              What's reviewed
            </p>
            <ul className="text-sm text-foreground space-y-1.5">
              <li>• Certifications & credentials</li>
              <li>• Profile photo & bio</li>
              <li>• Travel zone coverage</li>
              <li>• Service catalog quality</li>
            </ul>
          </div>
          {!already && !approved && (
            <p className="text-xs text-muted-foreground">
              Reviews typically take 1–2 business days. You can keep operating in the meantime.
            </p>
          )}
        </div>

        <div className="border-t border-black/5 bg-white/80 backdrop-blur-md px-6 py-4 flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-12 rounded-full flex-1 active:scale-95 transition-transform duration-200"
            data-testid="verification-close-btn"
          >
            {already || approved ? "Got it" : "Not now"}
          </Button>
          {!already && !approved && (
            <Button
              onClick={() => submit.mutate()}
              disabled={submit.isPending}
              className="h-12 rounded-full flex-1 font-semibold active:scale-95 transition-transform duration-200"
              data-testid="verification-submit-btn"
            >
              <Sparkles size={16} className="mr-1.5" />
              {submit.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
