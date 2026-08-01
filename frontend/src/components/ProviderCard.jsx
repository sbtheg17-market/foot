import React from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import PlanBadge from "./PlanBadge";
import { CLIENT } from "../constants/testIds";
import { Button } from "./ui/button";

export default function ProviderCard({ provider }) {
  return (
    <article
      data-testid={CLIENT.providerCard(provider.id)}
      className="group rounded-3xl border border-border bg-card p-6 soft-shadow hover:-translate-y-0.5 transition-transform"
    >
      <div className="flex items-start gap-4">
        <img
          src={provider.avatar_url}
          alt={provider.name}
          className="h-16 w-16 rounded-2xl object-cover border border-border"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-heading text-lg font-semibold truncate">{provider.name}</h3>
            {provider.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
            <PlanBadge plan={provider.plan} />
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {provider.city}
            </span>
            {provider.rating > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-4 w-4 fill-current text-amber-500" />
                {provider.rating.toFixed(1)}
                <span className="text-xs">({provider.reviews_count})</span>
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground line-clamp-2">{provider.bio}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {provider.categories.map((c) => (
          <span key={c} className="rounded-full bg-secondary text-secondary-foreground px-2.5 py-1 text-[11px] font-medium capitalize">
            {c.replace("-", " ")}
          </span>
        ))}
        {provider.senior_friendly && (
          <span className="rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-medium">
            Senior-friendly
          </span>
        )}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Travel radius {provider.travel_zone?.radius_km ?? 15} km
        </span>
        <Link to={`/providers/${provider.id}`}>
          <Button
            size="lg"
            className="rounded-full h-11 px-5 bg-primary hover:bg-primary/90"
            data-testid={CLIENT.providerCardBook(provider.id)}
          >
            View & book
          </Button>
        </Link>
      </div>
    </article>
  );
}
