import React, { useState } from 'react';
import { Link } from 'wouter';
import { useListProviders, ProviderSummary } from '@workspace/api-client-react';
import { MapPin, Star, Search, ShieldCheck } from 'lucide-react';

export default function Discover() {
  const [cityFilter, setCityFilter] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedCity(cityFilter), 500);
    return () => clearTimeout(timer);
  }, [cityFilter]);

  const { data, isLoading } = useListProviders({ 
    city: debouncedCity || undefined, 
    verified: verifiedOnly || undefined 
  });

  return (
    <div className="flex-1 flex flex-col pb-10">
      <div className="bg-primary px-6 py-10 rounded-b-[2.5rem] shadow-sm relative overflow-hidden">
        {/* Decorative background shapes */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-12 w-48 h-48 bg-black/10 rounded-full blur-2xl pointer-events-none" />
        
        <h1 className="text-4xl font-serif font-semibold text-primary-foreground mb-3 relative z-10 leading-tight">
          Professional foot care,<br/>in your home.
        </h1>
        <p className="text-primary-foreground/80 text-lg mb-8 relative z-10 max-w-sm">
          Find certified nurses and specialists near you.
        </p>

        <div className="relative z-10 bg-white rounded-2xl shadow-lg p-2 flex items-center">
          <div className="pl-3 pr-2 text-muted-foreground">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Search by city..."
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="flex-1 py-3 px-2 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-lg"
          />
        </div>
      </div>

      <div className="px-6 mt-6 flex items-center justify-between">
        <h2 className="text-xl font-serif font-semibold">Available Providers</h2>
        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer">
          <input 
            type="checkbox" 
            checked={verifiedOnly} 
            onChange={e => setVerifiedOnly(e.target.checked)}
            className="rounded text-primary focus:ring-primary border-border w-4 h-4 accent-primary"
          />
          Verified only
        </label>
      </div>

      <div className="px-6 mt-6 flex flex-col gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse flex gap-4 h-32" />
          ))
        ) : data?.providers.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="font-serif font-medium text-lg mb-1">No providers found</h3>
            <p className="text-muted-foreground">Try adjusting your search criteria.</p>
          </div>
        ) : (
          data?.providers.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))
        )}
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderSummary }) {
  return (
    <Link href={`/providers/${provider.id}`}>
      <div className="bg-card border border-border rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98]">
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden relative">
            {provider.avatarUrl ? (
              <img src={provider.avatarUrl} alt={provider.firstName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-serif font-bold text-secondary-foreground">
                {provider.firstName[0]}
              </span>
            )}
            {provider.verificationStatus === 'approved' && (
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-primary fill-primary/20" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-semibold text-lg text-foreground truncate">
              {provider.firstName} {provider.lastName}
            </h3>
            <p className="text-primary text-sm font-medium mb-1 truncate">{provider.title}</p>
            
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-accent text-accent" />
                <span className="font-semibold text-foreground">{provider.rating}</span>
                <span>({provider.reviewCount})</span>
              </div>
              <div className="flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{provider.city}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
