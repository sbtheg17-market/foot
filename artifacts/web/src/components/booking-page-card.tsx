/**
 * Provider dashboard card for the canonical public booking page (roadmap #11).
 *
 * Publish/unpublish the one provider-owned booking page at /book/:slug, copy
 * or natively share the canonical link, open a preview, and generate a
 * downloadable QR code. The QR always encodes the canonical URL plus the
 * allowlisted `source=qr-card` attribution parameter — never a duplicate page
 * and never sensitive data. Honest copy: sharing the link is provider-driven;
 * no automatic marketplace client acquisition is promised.
 */
import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Link2, Share2, Copy, Check, ExternalLink, QrCode, Globe2, EyeOff, Loader2,
} from 'lucide-react';
import {
  useGetMyBookingPage,
  usePublishMyBookingPage,
  useUnpublishMyBookingPage,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { publicBookingPageUrl } from '@/lib/routes';
import { canNativeShare, copyText } from '@/components/share-listing-actions';

const SHARE_TITLE = 'OnCall Foot';
const SHARE_TEXT = 'Book an in-home foot care appointment with me directly:';

export default function BookingPageCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGetMyBookingPage({
    query: { queryKey: ['my-booking-page'] },
  });
  const publish = usePublishMyBookingPage();
  const unpublish = useUnpublishMyBookingPage();

  const [copied, setCopied] = React.useState(false);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [qrBusy, setQrBusy] = React.useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['my-booking-page'] });

  if (isLoading) {
    return (
      <section className="bg-card border border-border rounded-3xl p-6" data-testid="booking-page-card-loading">
        <div className="h-5 w-48 bg-secondary rounded animate-pulse" />
      </section>
    );
  }
  if (isError || !data?.bookingPage) return null;

  const bp = data.bookingPage;
  const url = bp.slug ? publicBookingPageUrl(bp.slug) : null;

  const handlePublish = () =>
    publish.mutate(undefined, {
      onSuccess: () => {
        toast({ title: 'Booking page published', description: 'Your public booking link is live.' });
        void refresh();
      },
      onError: () =>
        toast({ title: "Couldn't publish", description: 'Please try again.', variant: 'destructive' }),
    });

  const handleUnpublish = () =>
    unpublish.mutate(undefined, {
      onSuccess: () => {
        setQrDataUrl(null);
        toast({ title: 'Booking page unpublished', description: 'Your link is no longer public. Republishing restores the same URL.' });
        void refresh();
      },
      onError: () =>
        toast({ title: "Couldn't unpublish", description: 'Please try again.', variant: 'destructive' }),
    });

  const handleCopy = async () => {
    if (!url) return;
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      toast({ title: 'Link copied', description: 'Your booking page link is on the clipboard.' });
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ title: "Couldn't copy the link", description: 'Select the URL and copy it manually.', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    if (!url) return;
    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      await handleCopy();
    }
  };

  const handleQr = async () => {
    if (!bp.slug || qrBusy) return;
    setQrBusy(true);
    try {
      const QRCode = await import('qrcode');
      // Canonical URL + allowlisted qr-card attribution; nothing sensitive.
      const target = publicBookingPageUrl(bp.slug, 'qr-card');
      const dataUrl = await QRCode.toDataURL(target, { width: 512, margin: 2 });
      setQrDataUrl(dataUrl);
    } catch {
      toast({ title: "Couldn't generate the QR code", description: 'Please try again.', variant: 'destructive' });
    } finally {
      setQrBusy(false);
    }
  };

  const btn =
    'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
  const primaryBtn = `${btn} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60`;
  const outlineBtn = `${btn} border border-border bg-card text-foreground hover:border-primary/50 disabled:opacity-60`;

  return (
    <section className="bg-card border border-border rounded-3xl p-6" data-testid="booking-page-card">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-serif font-semibold text-foreground">Your public booking page</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        One link clients can use to book you directly — share it on Instagram, in texts,
        on QR cards, or from your own website. You control when it's live.
      </p>

      {!bp.eligible ? (
        <div
          className="bg-secondary/60 border border-border rounded-2xl p-4 text-sm text-muted-foreground"
          data-testid="booking-page-not-eligible"
        >
          Publishing unlocks once your provider application is approved.
        </div>
      ) : !bp.published ? (
        <div data-testid="booking-page-unpublished">
          <div className="bg-secondary/60 border border-border rounded-2xl p-4 text-sm text-muted-foreground mb-4">
            Your page is <span className="font-semibold text-foreground">not public yet</span>.
            Publishing creates your permanent link{bp.slug ? '' : ' from your name'} and makes it
            bookable. Clients you share it with can book you directly — publishing alone doesn't
            advertise you to marketplace clients.
          </div>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publish.isPending}
            data-testid="booking-page-publish-button"
            className={primaryBtn}
          >
            {publish.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Globe2 className="w-4 h-4" aria-hidden="true" />}
            {publish.isPending ? 'Publishing…' : 'Publish booking page'}
          </button>
        </div>
      ) : (
        <div data-testid="booking-page-published">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
            <p className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5">
              <Globe2 className="w-4 h-4" aria-hidden="true" /> Live — clients with this link can book you
            </p>
            <p className="mt-2 text-sm font-mono break-all text-emerald-900/90" data-testid="booking-page-url">
              {url}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canNativeShare() && (
              <button type="button" onClick={handleShare} aria-label="Share your booking page" data-testid="booking-page-share" className={primaryBtn}>
                <Share2 className="w-4 h-4" aria-hidden="true" /> Share
              </button>
            )}
            <button type="button" onClick={handleCopy} aria-label="Copy booking page link" data-testid="booking-page-copy" className={canNativeShare() ? outlineBtn : primaryBtn}>
              {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a
              href={bp.path ?? '#'}
              target="_blank"
              rel="noreferrer"
              aria-label="Open your public booking page"
              data-testid="booking-page-open"
              className={outlineBtn}
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" /> Preview
            </a>
            <button type="button" onClick={handleQr} disabled={qrBusy} aria-label="Generate a QR code for your booking page" data-testid="booking-page-qr-button" className={outlineBtn}>
              {qrBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <QrCode className="w-4 h-4" aria-hidden="true" />}
              QR code
            </button>
            <button type="button" onClick={handleUnpublish} disabled={unpublish.isPending} aria-label="Unpublish your booking page" data-testid="booking-page-unpublish-button" className={outlineBtn}>
              <EyeOff className="w-4 h-4" aria-hidden="true" />
              {unpublish.isPending ? 'Unpublishing…' : 'Unpublish'}
            </button>
          </div>

          {qrDataUrl && (
            <div className="mt-4 flex items-center gap-4" data-testid="booking-page-qr-result">
              <img
                src={qrDataUrl}
                alt={`QR code that opens your public booking page at ${url}`}
                className="w-32 h-32 rounded-xl border border-border bg-white"
              />
              <div className="text-sm text-muted-foreground">
                <p>Print it on cards or flyers — scanning opens your booking page.</p>
                <a
                  href={qrDataUrl}
                  download="booking-page-qr.png"
                  data-testid="booking-page-qr-download"
                  className="mt-2 inline-flex items-center gap-1.5 font-semibold text-primary"
                >
                  Download PNG
                </a>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            Unpublishing removes public access immediately; your data and URL are kept, and
            republishing restores the same link.
          </p>
        </div>
      )}
    </section>
  );
}
