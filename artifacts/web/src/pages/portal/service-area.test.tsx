import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PortalServiceArea from './service-area';
import {
  useGetMyServiceArea,
  useUpdateMyServiceArea,
  useAddMyServiceAreaPrefix,
  useRemoveMyServiceAreaPrefix,
} from '@workspace/api-client-react';
import { axeViolations } from '../../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useGetMyServiceArea: vi.fn(),
  useUpdateMyServiceArea: vi.fn(),
  useAddMyServiceAreaPrefix: vi.fn(),
  useRemoveMyServiceAreaPrefix: vi.fn(),
  getGetMyServiceAreaQueryKey: () => ['my-service-area'],
  // Transitive imports of `httpStatusOf` (use-notification-center).
  getProviderNotifications: vi.fn(),
  getGetProviderNotificationUnreadCountQueryKey: () => ['unread-count'],
  useGetProviderNotificationUnreadCount: vi.fn(),
  useMarkProviderNotificationRead: vi.fn(),
}));
const setLocation = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/provider/service-area', setLocation],
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const mockGet = vi.mocked(useGetMyServiceArea);
const mockUpdate = vi.mocked(useUpdateMyServiceArea);
const mockAdd = vi.mocked(useAddMyServiceAreaPrefix);
const mockRemove = vi.mocked(useRemoveMyServiceAreaPrefix);

const updateMutate = vi.fn();
const addMutate = vi.fn();
const removeMutate = vi.fn();

const configured = {
  configured: true,
  isActive: true,
  countryCode: 'CA',
  provinceCode: 'ON',
  city: 'Toronto',
  publicDescription: 'Serving downtown Toronto',
  prefixes: [
    { id: 11, countryCode: 'CA', prefix: 'M4C', createdAt: '2026-08-25T12:00:00.000Z' },
    { id: 12, countryCode: 'CA', prefix: 'M5V', createdAt: '2026-08-25T12:00:00.000Z' },
  ],
  bufferMinutes: 30,
  bufferSource: 'default',
  publishEligible: true,
};

const unconfigured = {
  configured: false,
  isActive: false,
  countryCode: 'CA',
  provinceCode: null,
  city: null,
  publicDescription: null,
  prefixes: [],
  bufferMinutes: 30,
  bufferSource: 'default',
  publishEligible: false,
};

function arm(
  serviceArea: Record<string, unknown> | null,
  { loading = false, errorStatus = null as number | null } = {},
) {
  mockGet.mockReturnValue({
    data: serviceArea ? { serviceArea } : undefined,
    isLoading: loading,
    isError: errorStatus !== null,
    isSuccess: Boolean(serviceArea),
    error: errorStatus !== null ? { status: errorStatus } : null,
    refetch: vi.fn(),
    isFetching: false,
  } as unknown as ReturnType<typeof useGetMyServiceArea>);
  mockUpdate.mockReturnValue({ mutate: updateMutate, isPending: false } as unknown as ReturnType<typeof useUpdateMyServiceArea>);
  mockAdd.mockReturnValue({ mutate: addMutate, isPending: false } as unknown as ReturnType<typeof useAddMyServiceAreaPrefix>);
  mockRemove.mockReturnValue({ mutate: removeMutate, isPending: false } as unknown as ReturnType<typeof useRemoveMyServiceAreaPrefix>);
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PortalServiceArea />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PortalServiceArea', () => {
  it('shows a loading state', () => {
    arm(null, { loading: true });
    renderPage();
    expect(screen.getByTestId('service-area-loading')).toBeInTheDocument();
  });

  it('shows the sign-in state on 401', () => {
    arm(null, { errorStatus: 401 });
    renderPage();
    expect(screen.getByTestId('service-area-unauthorized')).toBeInTheDocument();
  });

  it('shows the provider-only state on 403', () => {
    arm(null, { errorStatus: 403 });
    renderPage();
    expect(screen.getByTestId('service-area-forbidden')).toBeInTheDocument();
  });

  it('shows a retryable error state on server failure', () => {
    arm(null, { errorStatus: 500 });
    renderPage();
    expect(screen.getByTestId('service-area-error')).toBeInTheDocument();
    expect(screen.getByTestId('service-area-retry')).toBeInTheDocument();
  });

  it('guides an unconfigured provider and gates prefix entry until saved', () => {
    arm(unconfigured);
    renderPage();
    expect(screen.getByTestId('service-area-status')).toHaveTextContent('Not set up yet');
    expect(screen.getByTestId('service-area-prefixes-empty')).toBeInTheDocument();
    expect(screen.getByTestId('service-area-prefix-input')).toBeDisabled();
    expect(screen.getByTestId('service-area-prefix-hint')).toBeInTheDocument();
  });

  it('saves the configuration with normalized fields', () => {
    arm(unconfigured);
    renderPage();
    fireEvent.change(screen.getByTestId('service-area-province-select'), { target: { value: 'ON' } });
    fireEvent.change(screen.getByTestId('service-area-city-input'), { target: { value: 'Toronto' } });
    fireEvent.change(screen.getByTestId('service-area-description-input'), {
      target: { value: 'Serving downtown Toronto' },
    });
    fireEvent.click(screen.getByTestId('service-area-save-btn'));
    expect(updateMutate).toHaveBeenCalledWith({
      data: {
        countryCode: 'CA',
        provinceCode: 'ON',
        city: 'Toronto',
        publicDescription: 'Serving downtown Toronto',
      },
    });
  });

  it('lists active postal areas and adds a new one', () => {
    arm(configured);
    renderPage();
    expect(screen.getByTestId('service-area-prefix-list')).toHaveTextContent('M4C');
    expect(screen.getByTestId('service-area-prefix-list')).toHaveTextContent('M5V');
    fireEvent.change(screen.getByTestId('service-area-prefix-input'), { target: { value: 'm6h' } });
    fireEvent.click(screen.getByTestId('service-area-prefix-add-btn'));
    expect(addMutate).toHaveBeenCalledWith({ data: { prefix: 'M6H' } });
  });

  it('removes a postal area with an accessible control', () => {
    arm(configured);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Remove postal area M5V' }));
    expect(removeMutate).toHaveBeenCalledWith({ prefixId: 12 });
  });

  it('shows the centrally managed 30-minute travel/setup buffer', () => {
    arm(configured);
    renderPage();
    expect(screen.getByTestId('service-area-buffer-minutes')).toHaveTextContent('30 minutes');
    expect(screen.getByTestId('service-area-buffer')).toHaveTextContent('travel and setup');
  });

  it('confirms publish readiness once coverage is configured', () => {
    arm(configured);
    renderPage();
    expect(screen.getByTestId('service-area-status')).toHaveTextContent('Your service area is set');
    expect(screen.getByTestId('service-area-client-view')).toHaveTextContent('never shown');
    expect(screen.getByTestId('service-area-preview-link')).toBeInTheDocument();
  });

  it('has no accessibility violations when configured', async () => {
    arm(configured);
    const { container } = renderPage();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no accessibility violations when unconfigured', async () => {
    arm(unconfigured);
    const { container } = renderPage();
    expect(await axeViolations(container)).toEqual([]);
  });
});
