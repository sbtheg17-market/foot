import React from "react";
import { Link } from "react-router-dom";
import { Leaf, BadgeCheck, Sparkles, Wallet } from "lucide-react";
import { Button } from "../components/ui/button";

export default function LoginPage() {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const startAuth = () => {
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="max-w-4xl mx-auto grid gap-10 lg:grid-cols-2 items-center py-8">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary text-primary px-3 py-1 text-xs font-medium">
          <Leaf className="h-3.5 w-3.5" /> Foot-Care Marketplace OS
        </span>
        <h1 className="mt-4 font-heading text-4xl sm:text-5xl font-semibold leading-[1.05]">
          One quiet, well-run marketplace for calm care.
        </h1>
        <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-lg">
          Book a therapist, run your practice, or approve new providers — all from one soft, honest home.
        </p>
        <div className="mt-8 space-y-4">
          <Feature icon={BadgeCheck} title="Verified providers only" desc="Every therapist is document-verified by our admin team." />
          <Feature icon={Sparkles} title="Booked in a minute" desc="Availability-aware time picker, instant confirmation, secure checkout." />
          <Feature icon={Wallet} title="Providers see real earnings" desc="Transparent commission math, plan tier boosts, opportunity insights." />
        </div>
      </div>
      <div className="rounded-3xl border border-border bg-card p-8 soft-shadow">
        <h2 className="font-heading text-2xl font-semibold">Sign in to continue</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We use Google sign-in so you don't have to remember another password. Client, provider, or admin — we'll route you to the right place.
        </p>
        <Button
          size="lg"
          data-testid="login-google-btn"
          onClick={startAuth}
          className="mt-6 w-full rounded-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground text-base"
        >
          Continue with Google
        </Button>
        <div className="mt-6 rounded-2xl bg-secondary/60 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground text-sm">Want to offer foot-care?</p>
          <p className="mt-1">Sign in first, then <Link to="/become-provider" className="text-primary font-medium underline underline-offset-2">apply to become a provider</Link> — the admin team will review your docs and approve your listing.</p>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }) {
  return (
    <div className="flex gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
