import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useUpdatePilotProviderRetention,
  getGetAdminPilotMetricsQueryKey,
} from '@workspace/api-client-react';
import type { PilotRetentionIntent } from '@workspace/api-client-react';
import { toast } from 'sonner';

const OPTIONS: Array<{ value: PilotRetentionIntent; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
];

/**
 * Platform-admin retention-intent control. Reuses the Part 1 PATCH hook —
 * no persistence or authorization logic lives here. On failure the previous
 * value is preserved and the failure is reported.
 */
export default function RetentionControl({
  providerId,
  providerName,
  value,
}: {
  providerId: string;
  providerName: string;
  value: PilotRetentionIntent;
}) {
  const queryClient = useQueryClient();
  const [localValue, setLocalValue] = useState<PilotRetentionIntent | null>(null);
  const [saved, setSaved] = useState(false);

  const mutation = useUpdatePilotProviderRetention({
    mutation: {
      onSuccess: () => {
        setSaved(true);
        queryClient.invalidateQueries({ queryKey: getGetAdminPilotMetricsQueryKey() });
      },
      onError: () => {
        setLocalValue(null);
        toast.error(
          `Couldn't save retention intent for ${providerName}. The previous value is unchanged.`,
        );
      },
    },
  });

  const shown = localValue ?? value;

  return (
    <span className="inline-flex items-center gap-2">
      <select
        data-testid={`retention-select-${providerId}`}
        aria-label={`Retention intent for ${providerName}`}
        value={shown}
        disabled={mutation.isPending}
        onChange={(e) => {
          const next = e.target.value as PilotRetentionIntent;
          setSaved(false);
          setLocalValue(next);
          mutation.mutate({ providerId: Number(providerId), data: { retentionIntent: next } });
        }}
        className="rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {saved && (
        <span
          role="status"
          data-testid={`retention-saved-${providerId}`}
          className="text-[11px] font-medium text-emerald-700"
        >
          Saved
        </span>
      )}
    </span>
  );
}
