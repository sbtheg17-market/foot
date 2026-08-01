import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listBookings, cents } from "../lib/api";
import { CLIENT } from "../constants/testIds";
import StatusBadge from "../components/StatusBadge";
import { EmptyState, LoadingBlock, ErrorBlock } from "../components/States";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { CalendarDays, Clock, MapPin } from "lucide-react";

export default function ClientBookings() {
  const [params] = useSearchParams();
  const initialEmail = params.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [applied, setApplied] = useState(initialEmail);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["bookings", "client", applied],
    queryFn: () => listBookings({ client_email: applied }),
    enabled: !!applied,
  });

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border bg-card p-6 soft-shadow">
        <h1 className="font-heading text-2xl md:text-3xl font-semibold">My bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter the email you booked with to see status updates.</p>
        <form
          onSubmit={(e) => { e.preventDefault(); setApplied(email); }}
          className="mt-4 flex gap-3 flex-wrap"
        >
          <Input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-full flex-1 min-w-[240px]"
            data-testid="client-bookings-email"
          />
          <Button type="submit" size="lg" className="h-12 rounded-full bg-primary" data-testid="client-bookings-load">
            Show bookings
          </Button>
        </form>
      </div>

      {applied && (
        <section>
          {isLoading && <LoadingBlock />}
          {error && <ErrorBlock error={error} retry={refetch} />}
          {data && data.length === 0 && (
            <EmptyState title="No bookings yet" message="When you book a visit, it'll show up here." />
          )}
          {data && data.length > 0 && (
            <div data-testid={CLIENT.bookingsList} className="grid gap-4">
              {data.map((b) => (
                <article
                  key={b.id}
                  data-testid={CLIENT.bookingRow(b.id)}
                  className="rounded-3xl border border-border bg-card p-6 soft-shadow flex flex-col md:flex-row md:items-center gap-4"
                >
                  <img src={b.provider?.avatar_url} alt="" className="h-14 w-14 rounded-2xl object-cover border border-border" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading font-semibold">{b.provider?.name}</h3>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{b.service?.title}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(b.start_time).toLocaleDateString()}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{new Date(b.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{b.provider?.city}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-heading text-xl font-semibold">{cents(b.gmv_cents)}</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
