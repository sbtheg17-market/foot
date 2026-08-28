/**
 * Provider portal nav — pending reschedule badge tests.
 *
 * Covers: badge absent at count 0, badge present with the true count (mobile
 * + desktop), deep link to /provider/bookings?tab=rescheduled only when work
 * is pending, 99+ cap, text/aria status (not color-only), and axe.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProviderLayout from './provider-layout';
import {
  useGetMe,
  useListBookings,
  useGetMyProviderReadiness,
  useLogout,
} from '@workspace/api-client-react';
import { useUnreadCount } from '../../hooks/use-notification-center';
import { axeViolations } from '../../test/axe';

vi.mock('@workspace/api-client-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@workspace/api-client-react')>();
  return {
    ...actual,
    useGetMe: vi.fn(),
    useListBookings: vi.fn(),
    useGetMyProviderReadiness: vi.fn(),
    useLogout: vi.fn(),
  };
});
vi.mock('../../hooks/use-provider-notifications', () => ({
  useProviderNotifications: vi.fn(),
}));
vi.mock('../../hooks/use-notification-center', () => ({
  useUnreadCount: vi.fn(),
}));
vi.mock('wouter', () => ({
  useLocation: () => ['/provider/dashboard', vi.fn()],
  Link: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockMe = vi.mocked(useGetMe);
const mockListBookings = vi.mocked(useListBookings);
const mockReadiness = vi.mocked(useGetMyProviderReadiness);
const mockLogout = vi.mocked(useLogout);
const mockUnread = vi.mocked(useUnreadCount);

function setup(counts: { requested?: number; rescheduled?: number } = {}) {
  mockMe.mockReturnValue({
    data: { user: { id: 1 } },
    isLoading: false,
    error: null,
  } as never);
  mockListBookings.mockImplementation(
    ((params: { status: string }) => ({
      data: {
        total:
          params.status === 'rescheduled'
            ? (counts.rescheduled ?? 0)
            : (counts.requested ?? 0),
      },
    })) as never,
  );
  mockReadiness.mockReturnValue({ data: undefined } as never);
  mockLogout.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  mockUnread.mockReturnValue({ data: { unreadCount: 0 } } as never);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProviderLayout>
        <div>content</div>
      </ProviderLayout>
    </QueryClientProvider>,
  );
}

function bookingsLinks(): HTMLAnchorElement[] {
  return screen.getAllByRole('link', { name: /bookings/i }) as HTMLAnchorElement[];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('provider nav reschedule badge', () => {
  it('shows no badge and the plain bookings link when nothing is pending', () => {
    setup({ rescheduled: 0 });
    expect(screen.queryByTestId('reschedule-nav-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reschedule-nav-badge-desktop')).not.toBeInTheDocument();
    for (const link of bookingsLinks()) {
      expect(link.getAttribute('href')).toBe('/provider/bookings');
    }
  });

  it('shows the true count on mobile and desktop and deep-links to the Reschedules tab', () => {
    setup({ rescheduled: 3 });
    expect(screen.getByTestId('reschedule-nav-badge')).toHaveTextContent('3');
    expect(screen.getByTestId('reschedule-nav-badge-desktop')).toHaveTextContent('3');
    const links = bookingsLinks();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/provider/bookings?tab=rescheduled');
    }
  });

  it('conveys the status as text via aria-label, not color alone', () => {
    setup({ rescheduled: 1 });
    expect(screen.getByTestId('reschedule-nav-badge')).toHaveAttribute(
      'aria-label',
      '1 pending reschedule request awaiting your response',
    );
    expect(screen.getByTestId('reschedule-nav-badge-desktop')).toHaveAttribute(
      'aria-label',
      '1 pending reschedule request awaiting your response',
    );
  });

  it('caps the displayed count at 99+', () => {
    setup({ rescheduled: 120 });
    expect(screen.getByTestId('reschedule-nav-badge')).toHaveTextContent('99+');
  });

  it('keeps the existing requested-count badge independent of the reschedule badge', () => {
    setup({ requested: 2, rescheduled: 1 });
    const badge = screen.getByTestId('reschedule-nav-badge');
    expect(badge).toHaveTextContent('1');
    // The requested badge (unlabelled testid, top-right) still shows 2.
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('accessibility: no axe violations with badges visible', async () => {
    const { container } = setup({ requested: 2, rescheduled: 3 });
    expect(await axeViolations(container)).toEqual([]);
  });
});
