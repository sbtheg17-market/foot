import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { XCircle } from "lucide-react";

export default function PaymentCancel() {
  return (
    <div data-testid="payment-cancel" className="max-w-xl mx-auto rounded-3xl border border-border bg-card p-8 soft-shadow text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
        <XCircle className="h-7 w-7" />
      </div>
      <h1 className="mt-4 font-heading text-2xl font-semibold">Payment cancelled</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your booking wasn't confirmed. No card was charged. Feel free to try again.
      </p>
      <div className="mt-6 flex justify-center">
        <Link to="/"><Button className="rounded-full h-11 bg-primary">Browse providers</Button></Link>
      </div>
    </div>
  );
}
