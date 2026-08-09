import React from 'react';
import { useLocation } from 'wouter';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  XCircle,
  Send,
  RotateCcw,
  AlertCircle,
  LogIn,
} from 'lucide-react';
import type {
  ProviderNotification,
  ProviderNotificationType,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { ROUTES } from '@/lib/routes';
import {
  useNotificationFeed,
  useUnreadCount,
  useMarkRead,
  httpStatusOf,
} from '@/hooks/use-notification-center';

/** Icon + tone per notification type. Unknown/future types fall back safely. */
const TYPE_META: Record<
  ProviderNotificationType,
  { Icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  submitted: { Icon: Send, tone: 'bg-primary/10 text-primary' },
  reset_to_draft: { Icon: RotateCcw, tone: 'bg-accent/15 text-accent' },
  approved: { Icon: CheckCircle2, tone: 'bg-emerald-100 text-emerald-700' },
  rejected: { Icon: XCircle, tone: 'bg-destructive/10 text-destructive' },
};

function metaFor(type: ProviderNotificationType) {
  return TYPE_META[type] ?? { Icon: Bell, tone: 'bg-secondary text-secondary-foreground' };
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 45) return 'just now';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 pt-10 pb-32 max-w-2xl mx-auto space-y-6" data-testid="notifications-page">
      {children}
    </div>
  );
}

export default function PortalNotifications() {
  const [, setLocation] = useLocation();
  const feed = useNotificationFeed();
  const unread = useUnreadCount();
  const markRead = useMarkRead();

  const notifications: ProviderNotification[] =
    feed.data?.pages.flatMap((p) => p.notifications) ?? [];
  const unreadCount = unread.data?.unreadCount ?? 0;
  const hasUnreadVisible = notifications.some((n) => n.readAt === null);
  const errorStatus = httpStatusOf(feed.error);

  const openNotification = (n: ProviderNotification) => {
    if (n.readAt === null) markRead.mutate({ id: n.id });
    if (n.link) setLocation(n.link);
  };

  const markOne = (e: React.MouseEvent, n: ProviderNotification) => {
    e.stopPropagation();
    if (n.readAt === null) markRead.mutate({ id: n.id });
  };

  const markAllVisible = () => {
    notifications
      .filter((n) => n.readAt === null)
      .forEach((n) => markRead.mutate({ id: n.id }));
  };

  const Header = (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
          Notifications
        </h1>
        <p className="text-muted-foreground mt-1" data-testid="notifications-unread-summary">
          {unreadCount > 0
            ? `${unreadCount} unread`
            : 'You are all caught up'}
        </p>
      </div>
      {hasUnreadVisible && (
        <Button
          variant="outline"
          size="sm"
          onClick={markAllVisible}
          disabled={markRead.isPending}
          data-testid="notifications-mark-all"
          className="shrink-0 min-h-11"
        >
          <CheckCheck className="w-4 h-4 mr-1.5" />
          Mark all read
        </Button>
      )}
    </header>
  );

  // ── Loading (initial) ──────────────────────────────────────────────────────
  if (feed.isLoading) {
    return (
      <Shell>
        {Header}
        <ul className="space-y-3" aria-hidden="true" data-testid="notifications-loading">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="bg-card border border-border rounded-2xl p-4 flex gap-4">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  // ── Error states ───────────────────────────────────────────────────────────
  if (feed.isError) {
    if (errorStatus === 401) {
      return (
        <Shell>
          {Header}
          <Empty className="border" data-testid="notifications-unauthorized">
            <EmptyHeader>
              <EmptyMedia variant="icon"><LogIn /></EmptyMedia>
              <EmptyTitle>Please sign in</EmptyTitle>
              <EmptyDescription>Your session has expired. Sign in again to view your notifications.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setLocation(ROUTES.login)} data-testid="notifications-signin">Go to sign in</Button>
            </EmptyContent>
          </Empty>
        </Shell>
      );
    }
    if (errorStatus === 403) {
      return (
        <Shell>
          {Header}
          <Empty className="border" data-testid="notifications-forbidden">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Bell /></EmptyMedia>
              <EmptyTitle>Not available for this account</EmptyTitle>
              <EmptyDescription>Notifications are available to provider accounts.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Shell>
      );
    }
    return (
      <Shell>
        {Header}
        <Empty className="border" data-testid="notifications-error">
          <EmptyHeader>
            <EmptyMedia variant="icon"><AlertCircle /></EmptyMedia>
            <EmptyTitle>Couldn't load notifications</EmptyTitle>
            <EmptyDescription>Something went wrong. Please try again.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              onClick={() => feed.refetch()}
              disabled={feed.isFetching}
              data-testid="notifications-retry"
            >
              {feed.isFetching ? 'Retrying…' : 'Try again'}
            </Button>
          </EmptyContent>
        </Empty>
      </Shell>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (notifications.length === 0) {
    return (
      <Shell>
        {Header}
        <Empty className="border" data-testid="notifications-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Bell /></EmptyMedia>
            <EmptyTitle>No notifications yet</EmptyTitle>
            <EmptyDescription>Updates about your provider application will appear here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Shell>
    );
  }

  // ── List ───────────────────────────────────────────────────────────────────
  return (
    <Shell>
      {Header}
      <ul className="space-y-3" data-testid="notifications-list">
        {notifications.map((n) => {
          const { Icon, tone } = metaFor(n.type);
          const isUnread = n.readAt === null;
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => openNotification(n)}
                data-testid={`notification-${n.id}`}
                data-unread={isUnread}
                className={`w-full text-left flex gap-4 items-start rounded-2xl border p-4 transition-colors min-h-[64px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                  isUnread
                    ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                    : 'bg-card border-border hover:bg-secondary/50'
                }`}
              >
                <span className={`relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${tone}`}>
                  <Icon className="w-5 h-5" />
                  {isUnread && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-white"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                      {n.title}
                    </span>
                    <time
                      className="text-xs text-muted-foreground shrink-0"
                      dateTime={n.createdAt}
                    >
                      {relativeTime(n.createdAt)}
                    </time>
                  </span>
                  <span className="block text-sm text-muted-foreground mt-0.5 line-clamp-2">
                    {n.body}
                  </span>
                  {isUnread && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => markOne(e, n)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          markOne(e as unknown as React.MouseEvent, n);
                        }
                      }}
                      className="inline-flex items-center mt-2 text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                      data-testid={`notification-mark-${n.id}`}
                    >
                      Mark as read
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {feed.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => feed.fetchNextPage()}
            disabled={feed.isFetchingNextPage}
            data-testid="notifications-load-more"
            className="min-h-11"
          >
            {feed.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </Shell>
  );
}
