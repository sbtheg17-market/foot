import React from 'react';
import { useGetMyLeads } from '@workspace/api-client-react';
import LeadActivityView from '@/components/leads/lead-activity-view';

/**
 * /provider/leads — "Daily Ground Game" (read-only shell).
 *
 * Owner-scoped read (GET /api/providers/me/leads). No lead source is connected
 * in this slice, so the server returns connected:false, emptyReason
 * "not_connected", items:[] and the view shows the honest empty state.
 */
export default function PortalLeads() {
  const { data, isLoading, isError, refetch } = useGetMyLeads({
    query: { queryKey: ['my-leads'] },
  });

  return (
    <LeadActivityView
      testId="provider-leads"
      title="Today's Leads"
      subtitle="Your daily ground game — incoming interest, its source, and the next step."
      data={data}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
    />
  );
}
