import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  useCreateProviderApplication,
  useGetMe,
  useGetProviderApplication,
  useSubmitProviderApplication,
  useUpdateProviderApplication,
} from '@workspace/api-client-react';
import { ROUTES } from '@/lib/routes';

function errorMessage(error: unknown, fallback: string) {
  const response = error as { response?: { data?: { error?: string } } };
  return response.response?.data?.error ?? fallback;
}

export default function ProviderOnboarding() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading, error: meError } = useGetMe();
  const canUseProviderOnboarding = Boolean(me?.user.roles?.includes('provider'));
  const applicationQuery = useGetProviderApplication({
    query: { enabled: Boolean(me?.user), retry: false, queryKey: ['provider-application'] },
  });
  const createApplication = useCreateProviderApplication();
  const updateApplication = useUpdateProviderApplication();
  const submitApplication = useSubmitProviderApplication();

  const application = applicationQuery.data?.application;
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    if (!meLoading && (meError || !me?.user)) setLocation(ROUTES.login, { replace: true });
    if (me?.user && !canUseProviderOnboarding && !startedRef.current) {
      startedRef.current = true;
      createApplication.mutate(undefined, {
        onSuccess: () => applicationQuery.refetch(),
        onError: (err) => setError(errorMessage(err, 'We could not start provider onboarding.')),
      });
    }
  }, [applicationQuery, canUseProviderOnboarding, createApplication, me, meError, meLoading, setLocation]);

  useEffect(() => {
    if (!application) return;
    setTitle(application.profile.title);
    setBio(application.profile.bio ?? '');
    setCity(application.profile.city);
    setYearsExperience(application.profile.yearsExperience?.toString() ?? '');
    if (application.status === 'under_review' || application.status === 'approved') {
      setLocation(
        application.status === 'approved' ? ROUTES.provider.root : ROUTES.provider.applicationStatus,
        { replace: true },
      );
    }
  }, [application, setLocation]);

  const busy = createApplication.isPending || updateApplication.isPending || submitApplication.isPending;
  const draftReady = Boolean(application && !applicationQuery.isLoading);
  const completion = useMemo(() => {
    return [title.trim(), bio.trim(), city.trim()].filter(Boolean).length;
  }, [bio, city, title]);

  const save = (submit = false) => {
    setError('');
    setMessage('');
    if (!title.trim() || !bio.trim() || !city.trim()) {
      setError('Add a title, short bio, and city before continuing.');
      return;
    }
    updateApplication.mutate(
      {
        data: {
          currentStep: submit ? 'submitted' : 'profile',
          title: title.trim(),
          bio: bio.trim(),
          city: city.trim(),
          yearsExperience: yearsExperience ? Number(yearsExperience) : undefined,
        },
      },
      {
        onSuccess: () => {
          if (!submit) {
            setMessage('Your progress is saved.');
            return;
          }
          submitApplication.mutate(undefined, {
            onSuccess: () => setLocation(ROUTES.provider.applicationStatus),
            onError: (err) => setError(errorMessage(err, 'We could not submit your application.')),
          });
        },
        onError: (err) => setError(errorMessage(err, 'We could not save your progress.')),
      },
    );
  };

  if (meLoading || applicationQuery.isLoading || !draftReady) {
    return (
      <main className="min-h-[100dvh] bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Preparing your provider workspace…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background px-5 py-8">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Provider onboarding</p>
          <h1 className="font-serif text-3xl font-bold text-foreground">Start with your professional profile</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Share the essentials first. You can add services, availability, and credentials as you continue.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Profile step</span>
            <span className="text-muted-foreground">{completion}/3 essentials</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completion / 3) * 100}%` }} />
          </div>
        </div>

        {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
        {message && <div role="status" className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">{message}</div>}

        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); save(true); }}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Professional title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="Certified mobile foot-care specialist" className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none ring-primary focus:ring-2" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Short bio</span>
            <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={2000} required rows={5} placeholder="Tell clients what kind of care you provide and what they can expect." className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 outline-none ring-primary focus:ring-2" />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">Primary city</span>
              <input value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} required placeholder="Austin" className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none ring-primary focus:ring-2" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">Years of experience <span className="font-normal text-muted-foreground">(optional)</span></span>
              <input type="number" min={0} max={80} value={yearsExperience} onChange={(event) => setYearsExperience(event.target.value)} placeholder="5" className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none ring-primary focus:ring-2" />
            </label>
          </div>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button type="button" onClick={() => save(false)} disabled={busy} className="flex-1 rounded-xl border border-border bg-card px-4 py-3 font-semibold text-foreground disabled:opacity-60">
              {updateApplication.isPending ? 'Saving…' : 'Save for later'}
            </button>
            <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? 'Working…' : 'Continue to review'}
            </button>
          </div>
        </form>
        <button type="button" onClick={() => setLocation(ROUTES.client.discover)} className="mt-6 w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground">
          Return to client experience
        </button>
      </div>
    </main>
  );
}