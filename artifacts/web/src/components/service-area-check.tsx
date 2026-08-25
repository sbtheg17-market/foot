/**
 * Public service-area eligibility step (roadmap #12) — shown on the
 * provider-owned booking page BEFORE service and slot selection.
 *
 * Server-authoritative: this component only collects the minimal location
 * details (country, province, city, postal code), submits them to
 * POST /booking-pages/:slug/service-area-check, and renders the safe state
 * + approved message the server returns. It never decides eligibility
 * itself and never sees raw provider coverage entries.
 */
import React, { useState } from 'react';
import { useCheckBookingPageServiceArea } from '@workspace/api-client-react';
import {
  MapPin, CheckCircle2, XCircle, HelpCircle, AlertTriangle, Loader2,
} from 'lucide-react';
import {
  CANADIAN_PROVINCES,
  SERVICE_AREA_UNAVAILABLE_MESSAGE,
} from '@/lib/canadian-geo';

export interface EligibilityResult {
  status: 'eligible' | 'ineligible' | 'needs_review' | 'invalid' | 'unavailable';
  message: string;
  location: { country: string; province: string; city: string; postalCode: string };
}

interface ServiceAreaSummary {
  configured: boolean;
  description: string | null;
  countryCode: string | null;
  provinceCode: string | null;
  city: string | null;
}

interface Props {
  slug: string;
  serviceArea: ServiceAreaSummary;
  eligibility: EligibilityResult | null;
  onResult: (result: EligibilityResult | null) => void;
}

const STATUS_PRESENTATION: Record<
  EligibilityResult['status'],
  { label: string; icon: React.ReactNode; tone: string }
> = {
  eligible: {
    label: 'You\u2019re in this provider\u2019s service area',
    icon: <CheckCircle2 className="w-5 h-5" aria-hidden="true" />,
    tone: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  },
  ineligible: {
    label: 'Outside this provider\u2019s service area',
    icon: <XCircle className="w-5 h-5" aria-hidden="true" />,
    tone: 'bg-red-50 border-red-200 text-red-900',
  },
  needs_review: {
    label: 'This location needs a quick review',
    icon: <HelpCircle className="w-5 h-5" aria-hidden="true" />,
    tone: 'bg-amber-50 border-amber-200 text-amber-900',
  },
  invalid: {
    label: 'Check your location details',
    icon: <AlertTriangle className="w-5 h-5" aria-hidden="true" />,
    tone: 'bg-amber-50 border-amber-200 text-amber-900',
  },
  unavailable: {
    label: 'Online booking unavailable',
    icon: <XCircle className="w-5 h-5" aria-hidden="true" />,
    tone: 'bg-secondary border-border text-foreground',
  },
};

const inputClass =
  'w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border ' +
  'focus:ring-2 focus:ring-primary focus:outline-none text-foreground';

export default function ServiceAreaCheck({ slug, serviceArea, eligibility, onResult }: Props) {
  const [province, setProvince] = useState(serviceArea.provinceCode ?? '');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const check = useCheckBookingPageServiceArea();

  // No active coverage configuration — the approved `unavailable` state.
  // Services and slots stay hidden; nothing provider-private is revealed.
  if (!serviceArea.configured) {
    return (
      <section
        className="rounded-2xl border border-border bg-secondary/60 p-5"
        data-testid="service-area-unavailable"
      >
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-foreground mb-1">Online booking unavailable</h2>
            <p className="text-sm text-muted-foreground leading-relaxed" role="status">
              {SERVICE_AREA_UNAVAILABLE_MESSAGE}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (check.isPending) return;
    const location = { country: 'CA', province, city: city.trim(), postalCode: postalCode.trim() };
    check.mutate(
      { slug, data: location },
      {
        onSuccess: (res) => {
          onResult({
            status: res.eligibility.status,
            message: res.eligibility.message,
            location,
          });
        },
        onError: () => {
          onResult(null);
        },
      },
    );
  };

  const presentation = eligibility ? STATUS_PRESENTATION[eligibility.status] : null;

  return (
    <section data-testid="service-area-check" aria-labelledby="service-area-heading">
      <h2 id="service-area-heading" className="text-xl font-serif font-semibold mb-1">
        Check your area
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Enter your postal code to confirm this provider serves your area.
      </p>

      {serviceArea.description && (
        <div className="rounded-2xl bg-secondary/60 p-4 mb-4" data-testid="service-area-summary">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm text-muted-foreground leading-relaxed">{serviceArea.description}</p>
          </div>
        </div>
      )}

      <form
        onSubmit={submit}
        className="rounded-2xl border border-border bg-card p-5 space-y-4"
        data-testid="service-area-form"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="sa-country" className="text-sm font-medium text-foreground">
              Country
            </label>
            <select id="sa-country" value="CA" disabled className={inputClass} data-testid="service-area-country">
              <option value="CA">Canada</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sa-province" className="text-sm font-medium text-foreground">
              Province or territory <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <select
              id="sa-province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              required
              className={inputClass}
              data-testid="service-area-province"
            >
              <option value="" disabled>
                Select…
              </option>
              {CANADIAN_PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sa-city" className="text-sm font-medium text-foreground">
              City <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="sa-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={120}
              autoComplete="address-level2"
              placeholder="e.g. Toronto"
              className={inputClass}
              data-testid="service-area-city"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sa-postal" className="text-sm font-medium text-foreground">
              Postal code <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <input
              id="sa-postal"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              maxLength={7}
              required
              autoComplete="postal-code"
              placeholder="e.g. M5V 2T6"
              className={inputClass}
              data-testid="service-area-postal"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={check.isPending || !province || !postalCode.trim()}
          data-testid="service-area-submit"
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-colors hover:bg-primary/90"
        >
          {check.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Checking…
            </>
          ) : (
            'Check availability'
          )}
        </button>

        {check.isError && !eligibility && (
          <p className="text-sm text-destructive" role="alert" data-testid="service-area-check-error">
            We couldn't check this location right now. Please try again.
          </p>
        )}
      </form>

      {/* Result — announced to screen readers, never color-only */}
      <div role="status" aria-live="polite">
        {eligibility && presentation && (
          <div
            className={`mt-4 rounded-2xl border p-4 flex items-start gap-3 ${presentation.tone}`}
            data-testid={`service-area-result-${eligibility.status}`}
          >
            <span className="mt-0.5 shrink-0">{presentation.icon}</span>
            <div>
              <p className="font-semibold text-sm">{presentation.label}</p>
              <p className="text-sm mt-0.5 leading-relaxed">{eligibility.message}</p>
              {eligibility.status === 'needs_review' && (
                <p className="text-sm mt-2 leading-relaxed" data-testid="service-area-needs-review-help">
                  Booking stays paused for this location until it's confirmed. You can
                  re-check with a corrected postal code, or ask the provider to review
                  your area before booking.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
