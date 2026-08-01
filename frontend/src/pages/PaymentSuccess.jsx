import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { paymentStatus, cents } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { LoadingBlock } from "../components/States";
import { Button } from "../components/ui/button";
import { CheckCircle2 } from "lucide-react";

const POLL_MS = 2000;
const MAX_POLLS = 15;

export default function PaymentSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState({ payment_status: "pending", booking: null });
  const [error, setError] = useState(null);
  const polls = useRef(0);

  useEffect(() => {
    if (!sessionId) { setError("Missing session id"); return; }
    let timer;
    const tick = async () => {
      polls.current += 1;
      try {
        const res = await paymentStatus(sessionId);
        setStatus(res);
        if (res.payment_status === "paid" || polls.current >= MAX_POLLS) return;
        timer = setTimeout(tick, POLL_MS);
      } catch (e) {
        setError(e?.response?.data?.detail || e.message);
      }
    };
    tick();
    return () => timer && clearTimeout(timer);
  }, [sessionId]);

  const b = status.booking;

  return (
    <div data-testid="payment-success" className="max-w-xl mx-auto rounded-3xl border border-border bg-card p-8 soft-shadow text-center">
      {status.payment_status !== "paid" ? (
        <>
          <LoadingBlock label="Confirming your payment…" />
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </>
      ) : (
        <>
          <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-semibold">Payment received</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your booking request is now with the provider. You'll get a text confirmation when they accept.
          </p>
          {b && (
            <div className="mt-6 rounded-2xl border border-border bg-secondary/40 p-4 text-left">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={b.status} />
              </div>
              <div className="mt-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">When</span><span>{new Date(b.start_time).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount paid</span><span className="font-semibold">{cents(b.gmv_cents)}</span></div>
              </div>
            </div>
          )}
          <div className="mt-6 flex gap-3 justify-center">
            <Button variant="outline" className="rounded-full h-11" onClick={() => navigate("/")}>Back to discover</Button>
            <Link to="/bookings">
              <Button className="rounded-full h-11 bg-primary">My bookings</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
