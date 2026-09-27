/**
 * Today's Leads read-only shell — web tests.
 *
 * Covers: the honest unconnected empty state ("Lead activity isn't connected
 * yet."), loading and error/retry states, the ABSENCE of any action controls
 * on the provider view, and the admin page's 401/403 self-gate. The API hooks
 * are mocked; no network. With no source connected these views render nothing
 * but the empty state — this is a shell, not a working lead inbox.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Router } from 'wouter';
import PortalLeads from '../pages/portal/leads';
import AdminGroundGame from '../pages/admin/ground-game';
import { useGetMyLeads, useGetAdminLeads } from '@workspace/api-client-react';

vi.mock('@workspace/api-client-react', () => ({
  useGetMyLeads: vi.fn(),
  useGetAdminLeads: vi.fn(),
}));

const unconnected = { connected: false, emptyReason: 'not_connected', items: [] };

const withRouter = (ui: React.ReactElement) => render(<Router>{ui}</Router>);

beforeEach(() => {
  vi.mocked(useGetMyLeads).mockReturnValue({
    data: unconnected,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as any);
  vi.mocked(useGetAdminLeads).mockReturnValue({
    data: unconnected,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as any);
});

describe("provider Today's Leads (read-only shell)", () => {
  it('shows the honest empty state when no source is connected', () => {
    withRouter(<PortalLeads />);
    expect(screen.getByTestId('provider-leads-empty')).toBeInTheDocument();
    expect(screen.getByText(/Lead activity isn't connected yet\./i)).toBeInTheDocument();
  });

  it('renders NO action controls (no reply/transfer/assign/status; no buttons)', () => {
    withRouter(<PortalLeads />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/reply|transfer|assign|status change/i)).toBeNull();
  });

  it('shows a loading state', () => {
    vi.mocked(useGetMyLeads).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    withRouter(<PortalLeads />);
    expect(screen.getByTestId('provider-leads-loading')).toBeInTheDocument();
  });

  it('shows an error state with a retry control', () => {
    vi.mocked(useGetMyLeads).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: null,
      refetch: vi.fn(),
    } as any);
    withRouter(<PortalLeads />);
    expect(screen.getByTestId('provider-leads-error')).toBeInTheDocument();
    expect(screen.getByTestId('provider-leads-retry')).toBeInTheDocument();
  });
});

describe('admin Ground Game (read-only shell)', () => {
  it('shows the honest empty state', () => {
    withRouter(<AdminGroundGame />);
    expect(screen.getByTestId('admin-leads-empty')).toBeInTheDocument();
    expect(screen.getByText(/Lead activity isn't connected yet\./i)).toBeInTheDocument();
  });

  it('self-gates on 403 (forbidden)', () => {
    vi.mocked(useGetAdminLeads).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { status: 403 },
      refetch: vi.fn(),
    } as any);
    withRouter(<AdminGroundGame />);
    expect(screen.getByTestId('admin-leads-access-denied')).toBeInTheDocument();
  });

  it('self-gates on 401 with a sign-in link', () => {
    vi.mocked(useGetAdminLeads).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { status: 401 },
      refetch: vi.fn(),
    } as any);
    withRouter(<AdminGroundGame />);
    expect(screen.getByTestId('admin-leads-auth-required')).toBeInTheDocument();
    expect(screen.getByTestId('admin-leads-login-link')).toBeInTheDocument();
  });
});
