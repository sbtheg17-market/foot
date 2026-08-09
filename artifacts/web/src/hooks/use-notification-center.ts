import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getProviderNotifications,
  getGetProviderNotificationUnreadCountQueryKey,
  useGetProviderNotificationUnreadCount,
  useMarkProviderNotificationRead,
  type ProviderNotificationListResponse,
  type ProviderNotificationUnreadCountResponse,
} from '@workspace/api-client-react';

/**
 * Notification Center — web client hooks.
 *
 * Frontend-only consumers of the EXISTING owner-scoped provider notification
 * APIs (MC8-lite). No new endpoints, schema, or notification semantics.
 *
 *   GET  /providers/notifications              (keyset, newest-first)
 *   GET  /providers/notifications/unread-count
 *   POST /providers/notifications/:id/read      (idempotent)
 *
 * This module deliberately touches ONLY in-app notification records. It has no
 * dependency on email, SMTP, push, SSE, or the notification-bus — preserving
 * the provider-agnostic channel abstraction (see
 * NOTIFICATION_ARCHITECTURE_CONSTRAINTS.md).
 */

export const DEFAULT_PAGE_LIMIT = 20;

/** Shared cache key for the paginated feed (infinite query). */
export const NOTIFICATION_FEED_KEY = ['provider', 'notifications', 'feed'] as const;

/** Reuse the generated client's unread-count key so every surface stays in sync. */
export const UNREAD_COUNT_KEY = getGetProviderNotificationUnreadCountQueryKey();

/** Extract an HTTP status from an unknown error (ApiError carries `.status`). */
export function httpStatusOf(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const s = (err as { status?: unknown }).status;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}

/**
 * Newest-first, keyset-paginated feed. Server order is preserved verbatim —
 * the client never re-sorts. Uses the generated fetcher via TanStack Query's
 * infinite query for correct opaque-cursor pagination.
 */
export function useNotificationFeed() {
  return useInfiniteQuery({
    queryKey: NOTIFICATION_FEED_KEY,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getProviderNotifications(
        pageParam
          ? { limit: DEFAULT_PAGE_LIMIT, cursor: pageParam }
          : { limit: DEFAULT_PAGE_LIMIT },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ProviderNotificationListResponse) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.nextCursor ?? undefined
        : undefined,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Owner-scoped unread total for the nav badge. Refreshes on window focus and
 * on a bounded interval — no realtime transport (SSE/push) in this checkpoint.
 */
export function useUnreadCount() {
  return useGetProviderNotificationUnreadCount({
    query: {
      queryKey: UNREAD_COUNT_KEY,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      staleTime: 10_000,
      retry: false,
    },
  });
}

type MarkCtx = {
  prevFeed?: InfiniteData<ProviderNotificationListResponse>;
  prevUnread?: ProviderNotificationUnreadCountResponse;
};

/**
 * Mark a single notification read — optimistic with rollback on failure.
 * Idempotent (re-marking an already-read item is a server no-op). On settle,
 * both the feed and the unread count are invalidated so the server stays the
 * source of truth for read-state.
 */
export function useMarkRead() {
  const qc = useQueryClient();

  return useMarkProviderNotificationRead<unknown, MarkCtx>({
    mutation: {
      onMutate: async ({ id }): Promise<MarkCtx> => {
        await qc.cancelQueries({ queryKey: NOTIFICATION_FEED_KEY });
        await qc.cancelQueries({ queryKey: UNREAD_COUNT_KEY });

        const prevFeed = qc.getQueryData<
          InfiniteData<ProviderNotificationListResponse>
        >(NOTIFICATION_FEED_KEY);
        const prevUnread = qc.getQueryData<ProviderNotificationUnreadCountResponse>(
          UNREAD_COUNT_KEY,
        );

        let wasUnread = false;
        if (prevFeed) {
          const nowIso = new Date().toISOString();
          const nextFeed: InfiniteData<ProviderNotificationListResponse> = {
            ...prevFeed,
            pages: prevFeed.pages.map((page) => ({
              ...page,
              notifications: page.notifications.map((n) => {
                if (n.id === id && n.readAt === null) {
                  wasUnread = true;
                  return { ...n, readAt: nowIso };
                }
                return n;
              }),
            })),
          };
          qc.setQueryData(NOTIFICATION_FEED_KEY, nextFeed);
        }

        if (wasUnread && prevUnread) {
          qc.setQueryData<ProviderNotificationUnreadCountResponse>(UNREAD_COUNT_KEY, {
            unreadCount: Math.max(0, prevUnread.unreadCount - 1),
          });
        }

        return { prevFeed, prevUnread };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.prevFeed) qc.setQueryData(NOTIFICATION_FEED_KEY, ctx.prevFeed);
        if (ctx?.prevUnread) qc.setQueryData(UNREAD_COUNT_KEY, ctx.prevUnread);
        toast.error("Couldn't mark as read. Please try again.");
      },
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: NOTIFICATION_FEED_KEY });
        void qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      },
    },
  });
}
