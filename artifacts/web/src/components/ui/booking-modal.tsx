import React, { useState } from 'react';
import { useCreateBooking } from '@workspace/api-client-react';
import { X, CalendarDays, MapPin, Clock, FileText } from 'lucide-react';
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

export default function BookingModal({ providerId, providerName, service, onClose, onSuccess }: BookingModalProps) {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    scheduledAt: '',
    address: '',
    city: '',
    postalCode: '',
    clientNotes: '',
  });

  const createBooking = useCreateBooking();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.scheduledAt || !form.address || !form.city) {
      toast.error('Please fill in all required fields.');
      return;
    }

    createBooking.mutate(
      {
        data: {
          providerId,
          serviceId: service.id,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
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
            data?: { error?: string; bookingId?: number } | null;
          };
          // Booking-race notice (Session 079): the friendly duplicate-booking
          // 409 contract (HTTP 409 + numeric bookingId) means this exact slot
          // is already held by an active booking. Show the approved notice and
          // keep the sheet open so the client can choose another time.
          // Detection is strict — any other error keeps its existing behavior.
          if (apiError.status === 409 && typeof apiError.data?.bookingId === 'number') {
            toast.info(
              'That time was just taken by another booking. Please choose another available time.',
            );
            return;
          }
          const msg = apiError.data?.error ?? 'Could not create booking. Please try again.';
          toast.error(msg);
        },
      }
    );
  };

  const minDateTime = () => {
    const d = new Date();
    d.setHours(d.getHours() + 2); // at least 2h from now
    return d.toISOString().slice(0, 16);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[500px] bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90dvh]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="px-6 pt-3 pb-4 flex items-start justify-between border-b border-border">
          <div>
            <h2 className="text-xl font-serif font-bold text-foreground">Book Appointment</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {providerName} · {service.title} · ${(service.priceCents / 100).toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-secondary/80 transition-colors mt-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Date & time */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Date &amp; time <span className="text-destructive">*</span>
            </label>
            <input
              type="datetime-local"
              required
              min={minDateTime()}
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
            />
          </div>

          {/* Address */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <MapPin className="w-4 h-4 text-primary" />
              Street address <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="123 Main St, Unit 4"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm placeholder:text-muted-foreground"
            />
          </div>

          {/* City + Postal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                City <span className="text-destructive">*</span>
              </label>
              <input
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
                type="text"
                placeholder="M5V 2T6"
                value={form.postalCode}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <FileText className="w-4 h-4 text-primary" />
              Notes for provider
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Any special requirements, mobility concerns, or preferences..."
              value={form.clientNotes}
              onChange={(e) => setForm((f) => ({ ...f, clientNotes: e.target.value }))}
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* Service summary */}
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <button
            type="submit"
            form="booking-form"
            onClick={handleSubmit}
            disabled={createBooking.isPending}
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
