import React, { useState } from 'react';
import { useRoute } from 'wouter';
import { 
  useGetProviderById, 
  useListProviderServices, 
  useListProviderReviews,
} from '@workspace/api-client-react';
import { MapPin, Star, ShieldCheck, Clock, ChevronLeft, CheckCircle2 } from 'lucide-react';
import BookingModal from '@/components/ui/booking-modal';

export default function ProviderProfile() {
  const [, params] = useRoute('/providers/:id');
  const providerId = Number(params?.id);
  
  const { data: providerRes, isLoading: loadingProvider } = useGetProviderById(providerId, {
    query: { enabled: !!providerId, queryKey: ['provider', providerId] }
  });
  
  const { data: servicesRes } = useListProviderServices(providerId, {
    query: { enabled: !!providerId, queryKey: ['services', providerId] }
  });

  const { data: reviewsRes } = useListProviderReviews(providerId, undefined, {
    query: { enabled: !!providerId, queryKey: ['reviews', providerId] }
  });

  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const selectedService = servicesRes?.services.find(s => s.id === selectedServiceId) ?? null;

  if (loadingProvider) {
    return <div className="p-6 pt-10 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  }

  if (!providerRes) return <div className="p-6">Provider not found</div>;
  const provider = providerRes.provider;

  return (
    <div className="flex-1 flex flex-col bg-card pb-24 relative">
      <div className="absolute top-4 left-4 z-10">
        <button onClick={() => window.history.back()} className="w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-foreground shadow-sm">
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="h-48 bg-secondary w-full relative">
         {provider.avatarUrl ? (
           <img src={provider.avatarUrl} className="w-full h-full object-cover" alt={`${provider.firstName} ${provider.lastName}`} />
        ) : (
          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                 <span className="text-6xl font-serif font-bold text-primary/30">{provider.firstName[0]}</span>
          </div>
        )}
      </div>
      
      <div className="px-6 -mt-8 relative z-10">
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-border/50">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground">
                {provider.firstName} {provider.lastName}
              </h1>
               <p className="text-primary font-medium">{provider.title || 'Foot care professional'}</p>
            </div>
             {provider.verificationStatus === 'approved' && (
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                 Credentials verified
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-4 border-t border-border pt-4">
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 fill-accent text-accent" />
              <span className="font-semibold text-foreground">{provider.rating}</span>
              <span>({provider.reviewCount} reviews)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              <span>{provider.city}</span>
            </div>
            {provider.yearsExperience && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{provider.yearsExperience} yrs exp.</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {provider.acceptsNewClients ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Accepting new clients
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary text-muted-foreground px-3 py-1.5 text-xs font-semibold">
                Currently fully booked
              </span>
            )}
            {provider.profileComplete && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary text-muted-foreground px-3 py-1.5 text-xs font-semibold">
                Complete provider profile
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 mt-8 space-y-8">
        <section>
          <h2 className="text-xl font-serif font-semibold mb-3">About</h2>
          <p className="text-muted-foreground leading-relaxed">
            {provider.bio || "This provider is adding more details about their approach."}
          </p>
        </section>

        {provider.serviceAreaNotes && (
          <section className="rounded-2xl bg-secondary/60 p-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h2 className="font-semibold mb-1">Service area</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{provider.serviceAreaNotes}</p>
              </div>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xl font-serif font-semibold mb-4">Services</h2>
          <div className="space-y-3">
            {servicesRes?.services.map(service => (
              <div 
                key={service.id} 
                onClick={() => setSelectedServiceId(service.id)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedServiceId === service.id ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-lg">{service.title}</h3>
                  <span className="font-serif font-semibold text-primary text-lg">
                    ${(service.priceCents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{service.durationMinutes} mins</span>
                </div>
                {service.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                )}
                {service.eligibilityNotes && (
                  <p className="text-xs text-foreground/70 mt-2">
                    <span className="font-semibold">Good to know:</span> {service.eligibilityNotes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-serif font-semibold mb-4">Reviews</h2>
          {reviewsRes?.reviews.length === 0 ? (
            <p className="text-muted-foreground italic">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviewsRes?.reviews.map(review => (
                <div key={review.id} className="p-4 bg-secondary/50 rounded-2xl">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium">{review.clientFirstName}</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-accent text-accent' : 'fill-muted text-muted'}`} />
                      ))}
                    </div>
                  </div>
                  {review.comment && <p className="text-sm text-foreground/80">{review.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Floating Action Area */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-border max-w-[500px] mx-auto z-40">
        <button 
          disabled={!selectedServiceId || !provider.acceptsNewClients}
          onClick={() => setShowBookingModal(true)}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {provider.acceptsNewClients ? (
            selectedServiceId ? 'Book Appointment' : 'Select a service to book'
          ) : 'Not accepting new clients'}
        </button>
      </div>

      {/* Booking Modal */}
      {showBookingModal && selectedService && (
        <BookingModal
          providerId={provider.id}
          providerName={`${provider.firstName} ${provider.lastName}`}
          service={selectedService}
          onClose={() => setShowBookingModal(false)}
          onSuccess={() => setShowBookingModal(false)}
        />
      )}
    </div>
  );
}
