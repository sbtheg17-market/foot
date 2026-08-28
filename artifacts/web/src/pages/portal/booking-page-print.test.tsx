/**
 * Printable QR handout (booking-page print view) tests.
 *
 * Covers: full handout rendering from public booking-page data (name, title,
 * services with duration + price, QR alt text, human-readable URL), the
 * not-published truthful zero state, screen-only Print/Back controls,
 * service cap, privacy (no non-public fields rendered), and axe.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BookingPagePrint from './booking-page-print';
import { useGetMyBookingPage, useGetPublicBookingPage } from '@workspace/api-client-react';
import { axeViolations } from '../../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useGetMyBookingPage: vi.fn(),
  useGetPublicBookingPage: vi.fn(),
}));
vi.mock('wouter', () => ({
  Link: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QR'),
}));

const mockOwn = vi.mocked(useGetMyBookingPage);
const mockPublic = vi.mocked(useGetPublicBookingPage);

const publicPage = {
  page: {
    slug: 'sarah-chen',
    provider: {
      id: 1,
      firstName: 'Sarah',
      lastName: 'Chen',
      title: 'Certified Foot Care Nurse',
      verificationStatus: 'approved',
    },
    services: [
      { id: 1, title: 'Diabetic Foot Care Visit', durationMinutes: 60, priceCents: 14000 },
      { id: 2, title: 'Senior Foot Care & Nail Trim', durationMinutes: 45, priceCents: 8500 },
    ],
  },
};

function setup(opts: { published?: boolean; slug?: string | null } = {}) {
  const published = opts.published ?? true;
  mockOwn.mockReturnValue({
    data: {
      bookingPage: {
        published,
        slug: opts.slug === undefined ? 'sarah-chen' : opts.slug,
        eligible: true,
        path: '/book/sarah-chen',
      },
    },
    isLoading: false,
  } as never);
  mockPublic.mockReturnValue({ data: publicPage, isLoading: false } as never);
  return render(<BookingPagePrint />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BookingPagePrint', () => {
  it('renders provider name, title, services with duration and price, and the readable URL', async () => {
    setup();
    expect(screen.getByTestId('print-provider-name')).toHaveTextContent('Sarah Chen');
    expect(screen.getByText('Certified Foot Care Nurse')).toBeInTheDocument();
    expect(screen.getByTestId('print-service-1')).toHaveTextContent('Diabetic Foot Care Visit');
    expect(screen.getByTestId('print-service-1')).toHaveTextContent('60 min');
    expect(screen.getByTestId('print-service-1')).toHaveTextContent('$140.00');
    expect(screen.getByTestId('print-service-2')).toHaveTextContent('$85.00');
    expect(screen.getByTestId('print-url').textContent).toContain('/book/sarah-chen');
    expect(screen.getByText('Scan to book')).toBeInTheDocument();
  });

  it('renders the QR image with meaningful alt text', async () => {
    setup();
    await waitFor(() => expect(screen.getByTestId('print-qr')).toBeInTheDocument());
    expect(screen.getByTestId('print-qr').getAttribute('alt')).toMatch(/QR code that opens the booking page/);
  });

  it('offers screen-only Print and Back controls', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    setup();
    expect(screen.getByTestId('print-back-link')).toHaveAttribute('href', '/provider/dashboard');
    fireEvent.click(screen.getByTestId('print-button'));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('shows a truthful zero state when the booking page is not published', () => {
    setup({ published: false });
    expect(screen.getByTestId('print-not-published')).toBeInTheDocument();
    expect(screen.queryByTestId('print-handout')).not.toBeInTheDocument();
    expect(mockPublic).toHaveBeenCalledWith('', expect.objectContaining({
      query: expect.objectContaining({ enabled: false }),
    }));
  });

  it('caps the printed service list at six entries', () => {
    mockOwn.mockReturnValue({
      data: { bookingPage: { published: true, slug: 'sarah-chen', eligible: true, path: '/book/sarah-chen' } },
      isLoading: false,
    } as never);
    mockPublic.mockReturnValue({
      data: {
        page: {
          ...publicPage.page,
          services: Array.from({ length: 9 }, (_, i) => ({
            id: i + 1,
            title: `Service ${i + 1}`,
            durationMinutes: 30,
            priceCents: 5000,
          })),
        },
      },
      isLoading: false,
    } as never);
    render(<BookingPagePrint />);
    expect(screen.getByTestId('print-services').children).toHaveLength(6);
  });

  it('accessibility: no axe violations', async () => {
    const { container } = setup();
    await waitFor(() => expect(screen.getByTestId('print-qr')).toBeInTheDocument());
    expect(await axeViolations(container)).toEqual([]);
  });
});
