/**
 * Support contact link (pilot readiness — docs/pilot/support-workflow.md).
 *
 * Renders the server-resolved support contact (env-configured with a
 * documented placeholder fallback). Server-authoritative: the UI never
 * hardcodes an address. Renders nothing until the contact is known.
 */
import React from 'react';
import { LifeBuoy } from 'lucide-react';
import { useGetSupportContact } from '@workspace/api-client-react';

export default function SupportContactLink({
  testId,
  className,
}: {
  testId: string;
  className?: string;
}) {
  const { data } = useGetSupportContact({
    query: { queryKey: ['support-contact'], staleTime: Infinity, retry: false },
  });
  const contact = data?.contact;
  if (!contact) return null;

  return (
    <a
      href={contact.url}
      data-testid={testId}
      className={
        className ??
        'inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4'
      }
    >
      <LifeBuoy className="w-4 h-4" aria-hidden="true" />
      <span>Need help? {contact.label}</span>
    </a>
  );
}
