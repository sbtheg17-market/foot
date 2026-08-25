/**
 * Share actions for a provider's canonical public listing.
 *
 * Canonical URL only: `/providers/:providerId` (see ROUTES.client.provider).
 * No slugs, referral codes, QR codes, or analytics events.
 *
 * Behavior:
 *   - Native Web Share (`navigator.share`) is offered only when the browser
 *     supports it (SSR-safe feature detection, user-gesture invocation).
 *   - User cancellation (`AbortError`) is a normal outcome — silent no-op.
 *   - Any other native-share failure falls back to Copy with a toast.
 *   - Copy link and Open listing are always available regardless of
 *     Web Share support.
 *   - Shares only public data: fixed marketing title/text + canonical URL.
 */
import React from 'react';
import { Link } from 'wouter';
import { Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ROUTES, publicListingUrl } from '@/lib/routes';

/** Fixed, public-only share payload (never includes private data). */
export const SHARE_TITLE = 'OnCall Foot';
export const SHARE_TEXT =
  'Book trusted in-home foot care with me on OnCall Foot.';

/** SSR-safe Web Share feature detection. */
export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Clipboard write with a legacy `execCommand` fallback. Returns success. */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

interface ShareListingActionsProps {
  /** provider_profiles.id — the id in the canonical public route. */
  providerId: number;
  /** 'full' (default) for the CTA card; 'compact' for the persistent row. */
  variant?: 'full' | 'compact';
}

export default function ShareListingActions({
  providerId,
  variant = 'full',
}: ShareListingActionsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const url = publicListingUrl(providerId);
  const supportsNativeShare = canNativeShare();

  const handleCopy = React.useCallback(async () => {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      toast({
        title: 'Link copied',
        description: 'Your public listing link is on the clipboard.',
      });
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast({
        title: "Couldn't copy the link",
        description: 'Select the listing URL and copy it manually.',
        variant: 'destructive',
      });
    }
  }, [toast, url]);

  const handleNativeShare = React.useCallback(async () => {
    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
    } catch (err) {
      // User cancellation is a normal, silent outcome.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Real failure → fall back to copying the link.
      await handleCopy();
    }
  }, [handleCopy, url]);

  const compact = variant === 'compact';
  const baseBtn =
    'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    (compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm');
  const primaryBtn = `${baseBtn} bg-primary text-primary-foreground hover:bg-primary/90`;
  const outlineBtn = `${baseBtn} border border-border bg-card text-foreground hover:border-primary/50`;
  const iconCls = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="share-listing-actions"
      data-variant={variant}
    >
      {supportsNativeShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          aria-label="Share your listing"
          data-testid="share-listing-native"
          className={primaryBtn}
        >
          <Share2 className={iconCls} aria-hidden="true" />
          Share
        </button>
      )}
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy listing link"
        data-testid="share-listing-copy"
        className={supportsNativeShare ? outlineBtn : primaryBtn}
      >
        {copied ? (
          <Check className={iconCls} aria-hidden="true" />
        ) : (
          <Copy className={iconCls} aria-hidden="true" />
        )}
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <Link
        href={ROUTES.client.provider(providerId)}
        aria-label="Open public listing"
        data-testid="share-listing-open"
        className={outlineBtn}
      >
        <ExternalLink className={iconCls} aria-hidden="true" />
        Open listing
      </Link>
    </div>
  );
}
