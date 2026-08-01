import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProviders, trackSearch } from "../lib/api";
import ProviderCard from "../components/ProviderCard";
import { CATEGORIES, CITIES } from "../constants/seed";
import { CLIENT } from "../constants/testIds";
import { EmptyState, LoadingBlock, ErrorBlock } from "../components/States";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Search, Sparkles } from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function ClientHome() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("all");
  const [category, setCategory] = useState("all");
  const [seniorOnly, setSeniorOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const params = useMemo(() => {
    const p = {};
    if (q) p.q = q;
    if (city !== "all") p.city = city;
    if (category !== "all") p.category = category;
    if (seniorOnly) p.senior_friendly = true;
    if (verifiedOnly) p.verified = true;
    return p;
  }, [q, city, category, seniorOnly, verifiedOnly]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["providers", params],
    queryFn: () => listProviders(params),
  });

  // Track meaningful searches (debounced) so the provider opportunities engine has real data.
  useEffect(() => {
    if (!q && city === "all" && category === "all" && !seniorOnly && !verifiedOnly) return;
    const t = setTimeout(() => {
      trackSearch({
        q: q || null,
        city: city !== "all" ? city : null,
        category: category !== "all" ? category : null,
        senior_friendly: seniorOnly || null,
        verified: verifiedOnly || null,
      });
    }, 800);
    return () => clearTimeout(t);
  }, [q, city, category, seniorOnly, verifiedOnly]);

  return (
    <div data-testid={CLIENT.home} className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-border soft-shadow">
        <img src={HERO_IMG} alt="Calm spa" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/70 via-primary/50 to-transparent" />
        <div className="relative px-8 py-16 md:py-24 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            In-home foot care, at your door
          </span>
          <h1 className="mt-4 font-heading text-4xl sm:text-5xl lg:text-6xl font-semibold text-white leading-[1.05]">
            Calm care. On your schedule.
          </h1>
          <p className="mt-4 text-white/90 max-w-lg text-base sm:text-lg">
            Verified reflexologists, massage therapists, and mobile pedicure specialists — booked in a minute.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 soft-shadow">
        <div className="grid gap-4 md:grid-cols-[1fr,180px,200px] items-center">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid={CLIENT.searchInput}
              placeholder="Search providers by name or specialty"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-12 pl-11 rounded-full text-base"
            />
          </div>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger data-testid={CLIENT.filterCity} className="h-12 rounded-full">
              <SelectValue placeholder="Any city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any city</SelectItem>
              {CITIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid={CLIENT.filterCategory} className="h-12 rounded-full">
              <SelectValue placeholder="Any service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any service</SelectItem>
              {CATEGORIES.map((c) => (<SelectItem key={c} value={c} className="capitalize">{c.replace("-", " ")}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            data-testid={CLIENT.filterSenior}
            onClick={() => setSeniorOnly((v) => !v)}
            className={`h-10 rounded-full px-4 text-sm font-medium border transition-colors ${
              seniorOnly ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground border-border hover:bg-secondary"
            }`}
          >Senior-friendly</button>
          <button
            data-testid={CLIENT.filterVerified}
            onClick={() => setVerifiedOnly((v) => !v)}
            className={`h-10 rounded-full px-4 text-sm font-medium border transition-colors ${
              verifiedOnly ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground border-border hover:bg-secondary"
            }`}
          >Verified only</button>
        </div>
      </section>

      <section>
        {isLoading && <LoadingBlock label="Finding calm providers near you…" />}
        {error && <ErrorBlock error={error} retry={refetch} />}
        {data && data.length === 0 && (
          <EmptyState title="No providers match yet" message="Try clearing a filter or exploring another city." />
        )}
        {data && data.length > 0 && (
          <div data-testid={CLIENT.providerGrid} className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.map((p) => (<ProviderCard key={p.id} provider={p} />))}
          </div>
        )}
      </section>
    </div>
  );
}
