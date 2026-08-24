import React, { useMemo, useState } from 'react';
import { useCreateBooking, useGetProviderSlots } from '@workspace/api-client-react';
import { X, CalendarDays, MapPin, Clock, FileText, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

interface Service {
  id: number;
  title: string;
  priceCents: number;
  durationMinutes: number;
}

interface BookingModalProps {
  providerId: number;
  providerName: string;
  service: Service;
  onClose: () => void;
  onSuccess: () => void;
}

/** Local YYYY-MM-DD for a Date (used for the date picker default + bounds). */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BookingModal({ providerId, providerName, service, onClose, onSuccess }: BookingModalProps) {
  const [, setLocation] = useLocation();
  const today = useMemo(() => toDateInput(new Date()), []);
  const [date, setDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ address: '', city: '', postalCode: '', clientNotes: '' });

  const {
    data: slotsRes,
    isLoading: loadingSlots,
    refetch: refetchSlots,
  } = useGetProviderSlots(
    providerId,
    { serviceId: service.id, date },
    { query: { queryKey: ['slots', providerId, service.id, date] } },
  );

  const timezone = slotsRes?.timezone;
  const slots = slotsRes?.slots ?? [];

  const createBooking = useCreateBooking();

  const slotLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      ...(timezone ? { timeZone: timezone } : {}),
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      toast.error('Please choose an available time slot.');
      return;
    }
    if (!form.address || !form.city) {
      toast.error('Please fill in the address and city.');
      return;
    }

    createBooking.mutate(
      {
        data: {
          providerId,
          serviceId: service.id,
          scheduledAt: selectedSlot,
          address: form.address,
          city: form.city,
          postalCode: form.postalCode || undefined,
          clientNotes: form.clientNotes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Booking requested! You\u2019ll hear back from the provider soon.");
          onSuccess();
          setLocation('/bookings');
        },
        onError: (err: unknown) => {
          const apiError = err as {
            status?: number;
            data?: { error?: string; reason?: string; bookingId?: number } | null;
          };
          const reason = apiError.data?.reason;
          // The slot was just taken, or is no longer within availability.
          // Refresh the grid and let the client pick a different time.
          if (reason === 'provider_unavailable' || reason === 'outside_availability') {
            toast.info('That time is no longer available. Please choose another slot.');
            setSelectedSlot(null);
            void refetchSlots();
            return;
          }
          if (reason === 'duplicate_booking') {
            toast.info('You already have a booking for this time. Check your bookings.');
            return;
          }
          const msg = apiError.data?.error ?? 'Could not create booking. Please try again.';
          toast.error(msg);
        },
      },
    );
  };

  return (
    <div
      data-testid="booking-modal"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[500px] bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90dvh]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-border" />
        </div>

        <div className="px-6 pt-3 pb-4 flex items-start justify-between border-b border-border">
          <div>
            <h2 className="text-xl font-serif font-bold text-foreground">Book Appointment</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {providerName} · {service.title} · ${(service.priceCents / 100).toFixed(2)}
            </p>
          </div>
          <button
            data-testid="booking-modal-close"
            type="button"
            aria-label="Close booking dialog"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-secondary/80 transition-colors mt-1"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Date */}
          <div>
            <label
              htmlFor="booking-date-input"
              className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2"
            >
              <CalendarDays className="w-4 h-4 text-primary" />
              Choose a date <span className="text-destructive">*</span>
            </label>
            <input
              id="booking-date-input"
              data-testid="booking-date-input"
              type="date"
              required
              min={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSelectedSlot(null);
              }}
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
            />
            {timezone && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2" data-testid="booking-timezone-label">
                <Globe className="w-3.5 h-3.5" />
                Times shown in {timezone.replace(/_/g, ' ')}
              </p>
            )}
          </div>

          {/* Slot grid */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <Clock className="w-4 h-4 text-primary" />
              Available times <span className="text-destructive">*</span>
            </label>
            {loadingSlots ? (
              <div className="py-6 flex justify-center">
                <div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4" data-testid="booking-no-slots">
                No available times on this date. Try another day.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2" data-testid="booking-slot-grid">
                {slots.map((slot) => {
                  const selected = selectedSlot === slot.start;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      data-testid={`booking-slot-${slot.start}`}
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot.start)}
                      className={`px-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                        !slot.available
                          ? 'border-border bg-secondary text-muted-foreground/50 line-through cursor-not-allowed'
                          : selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-foreground hover:border-primary/50'
                      }`}
                    >
                      {slotLabel(slot.start)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <MapPin className="w-4 h-4 text-primary" />
              Street address <span className="text-destructive">*</span>
            </label>
            <input
              data-testid="booking-address-input"
              type="text"
              required
              placeholder="123 Main St, Unit 4"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                City <span className="text-destructive">*</span>
              </label>
              <input
                data-testid="booking-city-input"
                type="text"
                required
                placeholder="Toronto"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Postal code</label>
              <input
                data-testid="booking-postal-input"
                type="text"
                placeholder="M5V 2T6"
                value={form.postalCode}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <FileText className="w-4 h-4 text-primary" />
              Notes for provider
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              data-testid="booking-notes-input"
              rows={3}
              placeholder="Any special requirements, mobility concerns, or preferences..."
              value={form.clientNotes}
              onChange={(e) => setForm((f) => ({ ...f, clientNotes: e.target.value }))}
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm placeholder:text-muted-foreground resize-none"
            />
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{service.title}</span>
              <span className="font-semibold text-foreground">${(service.priceCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Clock className="w-3.5 h-3.5" />
              {service.durationMinutes} minutes · at your home
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-border">
          <button
            data-testid="booking-submit-button"
            type="submit"
            onClick={handleSubmit}
            disabled={createBooking.isPending || !selectedSlot}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg shadow-md disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {createBooking.isPending ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Requesting…
              </>
            ) : (
              'Request Appointment'
            )}
          </button>
          <p className="text-center text-xs text-muted-foreground mt-3">
            The provider will confirm or decline within 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
