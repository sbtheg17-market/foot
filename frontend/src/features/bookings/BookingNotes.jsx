import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { api, formatApiErrorDetail } from "../../lib/api";
import { bookingKeys } from "./hooks";

/**
 * Private post-visit notes. Only visible to the provider; snapshotted so future
 * admin views can read them behind permission gates.
 */
export const BookingNotes = ({ booking }) => {
  const qc = useQueryClient();
  const [value, setValue] = useState(booking?.provider_notes || "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(booking?.provider_notes || "");
    setDirty(false);
  }, [booking?.id, booking?.provider_notes]);

  const save = useMutation({
    mutationFn: async () =>
      (await api.patch(`/bookings/${booking.id}/notes`, { provider_notes: value })).data,
    onSuccess: (updated) => {
      qc.setQueryData(bookingKeys.detail(booking.id), updated);
      qc.invalidateQueries({ queryKey: bookingKeys.all });
      setDirty(false);
      toast.success("Private note saved");
    },
    onError: (err) => toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message),
  });

  return (
    <section className="rounded-2xl bg-card border border-black/5 p-5" data-testid="booking-notes-editor">
      <div className="flex items-center gap-2 mb-1">
        <Lock size={12} className="text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Private note
        </h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Provider-only. Not shared with the client.
      </p>
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        placeholder="Post-visit observations, vitals, follow-up plan…"
        rows={4}
        className="rounded-xl resize-none"
        data-testid="booking-notes-input"
      />
      <div className="flex justify-end mt-3">
        <Button
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
          className="h-10 rounded-full px-5 font-semibold active:scale-95 transition-transform duration-200"
          data-testid="booking-notes-save-btn"
        >
          {save.isPending ? "Saving…" : "Save note"}
        </Button>
      </div>
    </section>
  );
};
