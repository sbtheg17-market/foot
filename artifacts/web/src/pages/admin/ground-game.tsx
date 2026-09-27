import React from 'react';
import { Link } from 'wouter';
import { Lock, ShieldAlert } from 'lucide-react';
import { useGetAdminLeads } from '@workspace/api-client-react';
import { ROUTES } from '@/lib/routes';
import LeadActivityView from '@/components/leads/lead-activity-view';

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

/**
 * /admin/ground-game — admin Today's Leads (read-only shell).
 *
 * Server-gated by requireAuth + requireRole('admin') on GET /api/admin/leads.
 * This page also self-gates on 401/403 like the other admin pages. No lead
 * source is connected in this slice → honest empty state.
 */
export default function AdminGroundGame() {
  const { data, isLoading, isError, error, refetch } = useGetAdminLeads({
    query: { queryKey: ['admin-leads'] },
  });

  const gate = errorStatus(error);
  if (gate === 401 || gate === 403) {
    return (
      <main
        className="min-h-screen bg-background p-6 max-w-md mx-auto text-center space-y-3"
        data-testid={gate === 401 ? 'admin-leads-auth-required' : 'admin-leads-access-denied'}
      >
        {gate === 403 ? (
          <ShieldAlert className="w-8 h-8 mx-auto text-muted-foreground" aria-hidden="true" />
        ) : (
          <Lock className="w-8 h-8 mx-auto text-muted-foreground" aria-hidden="true" />
        )}
        <p className="text-sm font-medium text-foreground">
          {gate === 401
            ? 'Sign in as a platform administrator to view leads.'
            : 'This area is restricted to platform administrators.'}
        </p>
        {gate === 401 && (
          <Link
            href={ROUTES.login}
            data-testid="admin-leads-login-link"
            className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Go to sign in
          </Link>
        )}
      </main>
    );
  }

  return (
    <LeadActivityView
      testId="admin-leads"
      title="Ground Game"
      subtitle="All incoming interest across the marketplace — source, position, owner, and next step."
      data={data}
      isLoading={isLoading}
      isError={isError && !gate}
      onRetry={() => refetch()}
    />
  );
}
