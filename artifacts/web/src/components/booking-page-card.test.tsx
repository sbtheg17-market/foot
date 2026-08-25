import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BookingPageCard from './booking-page-card';
import {
  useGetMyBookingPage,
  usePublishMyBookingPage,
  useUnpublishMyBookingPage,
} from '@workspace/api-client-react';
import { axeViolations } from '../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useGetMyBookingPage: vi.fn(),
  usePublishMyBookingPage: vi.fn(),
  useUnpublishMyBookingPage: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
const toDataURL = vi.fn(async (_text: string, _opts?: unknown) => 'data:image/png;base64,QR-TEST');
vi.mock('qrcode', () => ({ default: { toDataURL }, toDataURL }));

const mockGet = vi.mocked(useGetMyBookingPage);
const mockPublish = vi.mocked(usePublishMyBookingPage);
const mockUnpublish = vi.mocked(useUnpublishMyBookingPage);

const publishMutate = vi.fn();
const unpublishMutate = vi.fn();

function arm(bookingPage: Record<string, unknown> | null, { loading = false } = {}) {
  mockGet.mockReturnValue({
    data: bookingPage ? { bookingPage } : undefined,
    isLoading: loading,
    isError: false,
  } as unknown as ReturnType<typeof useGetMyBookingPage>);
  mockPublish.mockReturnValue({ mutate: publishMutate, isPending: false } as unknown as ReturnType<typeof usePublishMyBookingPage>);
  mockUnpublish.mockReturnValue({ mutate: unpublishMutate, isPending: false } as unknown as ReturnType<typeof useUnpublishMyBookingPage>);
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BookingPageCard />
    </QueryClientProvider>,
  );
}

const unpublished = {
  slug: null,
  published: false,
  publishedAt: null,
  path: null,
  eligible: true,
  verificationStatus: 'approved',
};

const published = {
  slug: 'sarah-chen',
  published: true,
  publishedAt: '2026-08-25T12:00:00.000Z',
  path: '/book/sarah-chen',
  eligible: true,
  verificationStatus: 'approved',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BookingPageCard', () => {
  it('explains that publishing unlocks after approval for unapproved providers', () => {
    arm({ ...unpublished, eligible: false, verificationStatus: 'pending' });
    renderCard();
    expect(screen.getByTestId('booking-page-not-eligible')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-page-publish-button')).not.toBeInTheDocument();
  });

  it('offers publish with honest copy when eligible and unpublished', () => {
    arm(unpublished);
    renderCard();
    expect(screen.getByTestId('booking-page-unpublished')).toHaveTextContent('not public yet');
    fireEvent.click(screen.getByTestId('booking-page-publish-button'));
    expect(publishMutate).toHaveBeenCalledTimes(1);
  });

  it('shows the canonical URL, copy, preview, and unpublish when published', () => {
    arm(published);
    renderCard();
    expect(screen.getByTestId('booking-page-url')).toHaveTextContent('/book/sarah-chen');
    expect(screen.getByTestId('booking-page-open')).toHaveAttribute('href', '/book/sarah-chen');
    fireEvent.click(screen.getByTestId('booking-page-unpublish-button'));
    expect(unpublishMutate).toHaveBeenCalledTimes(1);
  });

  it('generates a QR that encodes the canonical URL with the qr-card source', async () => {
    arm(published);
    renderCard();
    fireEvent.click(screen.getByTestId('booking-page-qr-button'));
    await waitFor(() => expect(screen.getByTestId('booking-page-qr-result')).toBeInTheDocument());
    expect(toDataURL).toHaveBeenCalledTimes(1);
    const encoded = toDataURL.mock.calls[0]?.[0] ?? '';
    expect(encoded).toContain('/book/sarah-chen?source=qr-card');
    const img = screen.getByRole('img', { name: /QR code that opens your public booking page/i });
    expect(img).toHaveAttribute('src', 'data:image/png;base64,QR-TEST');
    expect(screen.getByTestId('booking-page-qr-download')).toHaveAttribute('download', 'booking-page-qr.png');
  });

  it('has no accessibility violations in the published state', async () => {
    arm(published);
    const { container } = renderCard();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no accessibility violations in the unpublished state', async () => {
    arm(unpublished);
    const { container } = renderCard();
    expect(await axeViolations(container)).toEqual([]);
  });
});
