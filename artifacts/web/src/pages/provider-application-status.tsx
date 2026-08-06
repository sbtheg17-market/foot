import React, { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useGetMe, useGetProviderApplication } from '@workspace/api-client-react';
import { ROUTES } from '@/lib/routes';

const statusCopy: Record<string, { title: string; body: string }> = {
  under_review: {
    title: 'Your application is with our review team',
    body: 'We are checking your profile and credentials so clients can book with confidence. We will update this space when there is a decision.',
  },
  rejected: {
    title: 'A little more information is needed',
    body: 'Your application needs an update before it can move forward. Review the feedback and continue your profile when you are ready.',
  },
  suspended: {
    title: 'Your provider application is paused',
    body: 'Provider access is currently paused. Please contact support if you need help understanding the next step.',
  },
};

export default function ProviderApplicationStatus() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading, error: meError } = useGetMe();
  const query = useGetProviderApplication({ query: { enabled: Boolean(me?.user), retry: false, queryKey: ['provider-application'] } });
  const application = query.data?.application;

  useEffect(() => {
    if (!meLoading && (meError || !me?.user)) setLocation(ROUTES.login, { replace: true });
    if (application?.status === 'draft') setLocation(ROUTES.onboarding.provider, { replace: true });
    if (application?.status === 'approved') setLocation(ROUTES.provider.root, { replace: true });
  }, [application, me, meError, meLoading, setLocation]);

  const copy = statusCopy[application?.status ?? 'under_review'] ?? statusCopy.under_review;

  return (
    <main className="min-h-[100dvh] bg-background px-6 py-12">
      <div className="mx-auto flex w-full max-w-[520px] flex-col items-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground shadow-lg">O</div>
        {query.isLoading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        ) : (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Application status</p>
            <h1 className="mt-3 font-serif text-3xl font-bold text-foreground">{copy.title}</h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{copy.body}</p>
            <div className="mt-8 w-full rounded-2xl border border-border bg-card p-5 text-left">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Current status</span>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize text-secondary-foreground">{application?.status?.replace('_', ' ') ?? 'Loading'}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">You can still use your client account while provider review is in progress.</p>
            </div>
            {application?.status === 'rejected' && (
              <Link href={ROUTES.onboarding.provider} className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">Update application</Link>
            )}
            <Link href={ROUTES.client.discover} className="mt-4 text-sm font-medium text-muted-foreground hover:text-foreground">Continue as a client</Link>
          </>
        )}
      </div>
    </main>
  );
}