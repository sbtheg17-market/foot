/**
 * Printable QR handout for the provider's public booking page.
 *
 * Presentation-only view over EXISTING data: the owner booking-page read
 * (slug/publish state) plus the SAME public booking-page endpoint clients
 * see — so only already-public information can ever appear here (provider
 * name/title, active services, canonical URL). The QR encodes the canonical
 * URL with the existing allowlisted `source=qr-card` attribution.
 *
 * Screen: readable, mobile-friendly preview with Print / Back controls.
 * Print (`print:` variants + the layout's existing print:hidden chrome):
 * a single high-contrast, ink-friendly page with no navigation.
 */
import React from 'react';
import { Link } from 'wouter';
import { Printer, ArrowLeft } from 'lucide-react';
import { useGetMyBookingPage, useGetPublicBookingPage } from '@workspace/api-client-react';
import { publicBookingPageUrl, ROUTES } from '@/lib/routes';

function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}

const MAX_HANDOUT_SERVICES = 6;

export default function BookingPagePrint() {
  const { data: own, isLoading: ownLoading } = useGetMyBookingPage({
    query: { queryKey: ['my-booking-page'] },
  });
  const slug = own?.bookingPage?.published ? (own.bookingPage.slug ?? null) : null;

  const { data: pageData, isLoading: pageLoading } = useGetPublicBookingPage(slug ?? '', {
    query: { enabled: Boolean(slug), queryKey: ['public-booking-page', slug] },
  });

  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    if (!slug) return;
    (async () => {
      try {
        const QRCode = await import('qrcode');
        // Canonical public URL + existing allowlisted qr-card attribution.
        const dataUrl = await QRCode.toDataURL(publicBookingPageUrl(slug, 'qr-card'), {
          width: 512,
          margin: 2,
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        /* QR stays absent; the printed URL still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (ownLoading || (slug && pageLoading)) {
    return (
      <div className="p-6 pt-20 flex justify-center" data-testid="print-handout-loading">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!slug) {
    return (
      <div className="p-6 pt-16 max-w-lg mx-auto" data-testid="print-not-published">
        <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Printable handout</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Your handout is generated from your live public booking page. Publish your booking
          page first, then come back here to print it.
        </p>
        <Link
          href={ROUTES.provider.dashboard}
          data-testid="print-back-link"
          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to dashboard
        </Link>
      </div>
    );
  }

  const page = pageData?.page;
  const provider = page?.provider;
  const services = (page?.services ?? []).slice(0, MAX_HANDOUT_SERVICES);
  const displayUrl = publicBookingPageUrl(slug).replace(/^https?:\/\//, '');

  return (
    <div className="p-6 pt-10 pb-28 max-w-lg mx-auto print:p-0 print:pb-0 print:max-w-none">
      {/* Screen-only controls — never printed */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link
          href={ROUTES.provider.dashboard}
          data-testid="print-back-link"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          data-testid="print-button"
          className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Printer className="w-4 h-4" aria-hidden="true" /> Print handout
        </button>
      </div>

      {/* The handout itself — high-contrast and ink-friendly in print */}
      <section
        data-testid="print-handout"
        className="bg-card border border-border rounded-3xl p-8 text-center shadow-sm print:bg-white print:text-black print:border-0 print:shadow-none print:rounded-none"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-3 w-10 h-10 rounded-xl bg-primary text-primary-foreground font-serif font-bold text-xl flex items-center justify-center print:bg-black print:text-white"
        >
          O
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground print:text-black">
          OnCall Foot
        </p>

        <h1 data-testid="print-provider-name" className="mt-4 text-3xl font-serif font-bold text-foreground print:text-black">
          {provider ? `${provider.firstName} ${provider.lastName}` : ''}
        </h1>
        {provider?.title ? (
          <p className="mt-1 text-sm font-medium text-primary print:text-black">{provider.title}</p>
        ) : null}

        {services.length > 0 && (
          <ul data-testid="print-services" className="mt-6 text-left mx-auto max-w-xs space-y-2">
            {services.map((s) => (
              <li
                key={s.id}
                data-testid={`print-service-${s.id}`}
                className="flex items-baseline justify-between gap-3 text-sm border-b border-dashed border-border pb-2 print:border-black/30"
              >
                <span className="font-medium text-foreground print:text-black">
                  {s.title}
                  <span className="text-muted-foreground font-normal print:text-black"> · {s.durationMinutes} min</span>
                </span>
                <span className="font-semibold text-foreground print:text-black">{formatPrice(s.priceCents)}</span>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-8 text-lg font-serif font-semibold text-foreground print:text-black">Scan to book</h2>
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            data-testid="print-qr"
            alt={`QR code that opens the booking page at ${displayUrl}`}
            className="mx-auto mt-3 w-48 h-48 rounded-xl border border-border bg-white print:border-black/20"
          />
        )}
        <p data-testid="print-url" className="mt-3 text-sm font-mono break-all text-foreground print:text-black">
          {displayUrl}
        </p>
        <p className="mt-4 text-xs text-muted-foreground print:text-black">
          Scan the code or visit the link to book an in-home foot care visit directly.
        </p>
      </section>

      <p className="mt-4 text-xs text-muted-foreground text-center print:hidden">
        This handout shows only what's already public on your booking page.
      </p>
    </div>
  );
}
