import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";

/**
 * Dev-only demo reset. Guarded by an AlertDialog confirmation.
 * Reseeds bookings (and their invoices) to a known-good baseline.
 */
export const ReseedButton = () => {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const seed = useMutation({
    mutationFn: async () => (await api.post("/dev/seed-bookings")).data,
    onSuccess: (res) => {
      qc.invalidateQueries();
      toast.success(`Demo data reset · ${res.seeded} bookings`);
      setOpen(false);
    },
    onError: (err) => toast.error(err.message || "Couldn't reset demo data"),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-12 rounded-full font-semibold active:scale-95 transition-transform duration-200"
          data-testid="reseed-btn"
        >
          <Sparkles size={16} className="mr-1.5" /> Reset demo data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl" data-testid="reseed-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
          <AlertDialogDescription>
            This clears your current demo bookings and invoices and reseeds a fresh, believable
            set — a "today" visit, upcoming requests, past completions, and matching invoices.
            Your services, availability and profile are untouched.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="reseed-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              seed.mutate();
            }}
            disabled={seed.isPending}
            data-testid="reseed-confirm"
          >
            {seed.isPending ? "Resetting…" : "Reset now"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
