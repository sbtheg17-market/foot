import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  type SubmitVerificationDocRequestDocType,
  useCreateApplicationService,
  useCreateProviderApplication,
  useDeleteApplicationService,
  useGetApplicationAvailability,
  useGetMe,
  useGetMyVerification,
  useGetProviderApplication,
  useGetProviderApplicationCompletion,
  useListApplicationServices,
  useSetApplicationAvailability,
  useSubmitProviderApplication,
  useSubmitVerificationDoc,
  useUpdateApplicationService,
  useUpdateProviderApplication,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '@/lib/routes';

// ── helpers ──────────────────────────────────────────────────────────────────

function apiError(error: unknown, fallback: string): string {
  const r = error as { data?: { error?: string } };
  return r.data?.error ?? fallback;
}

type Step = 'profile' | 'services' | 'availability' | 'verification' | 'review';
const STEPS: Step[] = ['profile', 'services', 'availability', 'verification', 'review'];
const STEP_LABELS: Record<Step, string> = {
  profile: 'Profile',
  services: 'Services',
  availability: 'Availability',
  verification: 'Verification',
  review: 'Review & Submit',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtTime(t: string) {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h < 12 ? 'AM' : 'PM';
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${mStr} ${ampm}`;
}

// ── sub-components ────────────────────────────────────────────────────────────

interface ProgressBarProps {
  steps: Step[];
  current: Step;
  completion: Record<Step, boolean>;
  onNavigate: (s: Step) => void;
}

function ProgressBar({ steps, current, completion, onNavigate }: ProgressBarProps) {
  return (
    <nav aria-label="Onboarding progress" className="mb-8">
      <ol className="flex items-center gap-0">
        {steps.map((step, i) => {
          const done = completion[step];
          const active = step === current;
          return (
            <li key={step} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onNavigate(step)}
                className={[
                  'flex flex-col items-center gap-1 flex-1 min-w-0 px-1 py-2 rounded-xl transition-all',
                  active ? 'opacity-100' : 'opacity-60 hover:opacity-80',
                ].join(' ')}
              >
                <span className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold border-2 transition-all',
                  done
                    ? 'bg-primary border-primary text-primary-foreground'
                    : active
                    ? 'bg-card border-primary text-primary'
                    : 'bg-card border-border text-muted-foreground',
                ].join(' ')}>
                  {done ? '✓' : i + 1}
                </span>
                <span className={[
                  'hidden sm:block text-[11px] font-medium truncate max-w-[70px] text-center',
                  active ? 'text-foreground' : 'text-muted-foreground',
                ].join(' ')}>{STEP_LABELS[step]}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={['flex-0 h-0.5 w-4 mx-0.5 rounded-full transition-all', done ? 'bg-primary' : 'bg-border'].join(' ')} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── Profile step ──────────────────────────────────────────────────────────────

interface ProfileStepProps {
  application: { profile: { title: string; bio: string | null; city: string; yearsExperience: number | null }; status: string };
  onNext: () => void;
}

function ProfileStep({ application, onNext }: ProfileStepProps) {
  const [title, setTitle] = useState(application.profile.title);
  const [bio, setBio] = useState(application.profile.bio ?? '');
  const [city, setCity] = useState(application.profile.city);
  const [years, setYears] = useState(application.profile.yearsExperience?.toString() ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const update = useUpdateProviderApplication();
  const qc = useQueryClient();

  const save = (andContinue = false) => {
    setError('');
    setSaved(false);
    if (!title.trim() || !bio.trim() || !city.trim()) {
      setError('Title, bio, and city are all required.');
      return;
    }
    update.mutate(
      { data: { currentStep: 'services', title: title.trim(), bio: bio.trim(), city: city.trim(), yearsExperience: years ? Number(years) : undefined } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['provider-application'] });
          qc.invalidateQueries({ queryKey: ['provider-application-completion'] });
          if (andContinue) { onNext(); } else { setSaved(true); }
        },
        onError: (err) => setError(apiError(err, 'Could not save profile.')),
      },
    );
  };

  return (
    <div>
      <h2 className="font-serif text-2xl font-bold text-foreground mb-1">Professional profile</h2>
      <p className="text-sm text-muted-foreground mb-6">Tell clients who you are and where you work. All three fields below are required to submit your application.</p>

      {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {saved && <div role="status" className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">Profile saved ✓</div>}

      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(true); }}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">Professional title <span className="text-destructive">*</span></span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="Certified mobile foot-care specialist" className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none ring-primary focus:ring-2" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">Short bio <span className="text-destructive">*</span></span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000} required rows={5} placeholder="Tell clients what kind of care you provide and what they can expect." className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 outline-none ring-primary focus:ring-2" />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Primary city <span className="text-destructive">*</span></span>
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} required placeholder="Austin" className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none ring-primary focus:ring-2" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Years of experience <span className="text-muted-foreground font-normal">(optional)</span></span>
            <input type="number" min={0} max={80} value={years} onChange={(e) => setYears(e.target.value)} placeholder="5" className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none ring-primary focus:ring-2" />
          </label>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => save(false)} disabled={update.isPending} className="flex-1 rounded-xl border border-border bg-card px-4 py-3 font-semibold text-foreground disabled:opacity-60">
            {update.isPending && !update.isSuccess ? 'Saving…' : 'Save for later'}
          </button>
          <button type="submit" disabled={update.isPending} className="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60">
            Save and continue →
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Services step ─────────────────────────────────────────────────────────────

type ServiceDraft = { title: string; description: string; durationMinutes: string; priceCents: string; category: string };
const EMPTY_SERVICE: ServiceDraft = { title: '', description: '', durationMinutes: '60', priceCents: '8000', category: 'foot_care' };

interface ServicesStepProps {
  onNext: () => void;
  onBack: () => void;
}

function ServicesStep({ onNext, onBack }: ServicesStepProps) {
  const servicesQuery = useListApplicationServices({ query: { queryKey: ['app-services'] } });
  const createService = useCreateApplicationService();
  const updateService = useUpdateApplicationService();
  const deleteService = useDeleteApplicationService();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(EMPTY_SERVICE);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);

  const services = servicesQuery.data?.services ?? [];
  const busy = createService.isPending || updateService.isPending || deleteService.isPending;

  const openAdd = () => {
    setDraft(EMPTY_SERVICE);
    setEditId(null);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (s: typeof services[0]) => {
    setDraft({
      title: s.title,
      description: s.description ?? '',
      durationMinutes: String(s.durationMinutes),
      priceCents: String(s.priceCents),
      category: s.category,
    });
    setEditId(s.id);
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); setFormError(''); };

  const saveService = () => {
    setFormError('');
    if (!draft.title.trim()) { setFormError('Service name is required.'); return; }
    const dur = Number(draft.durationMinutes);
    if (!dur || dur < 15) { setFormError('Duration must be at least 15 minutes.'); return; }
    const price = Number(draft.priceCents);
    if (price < 0 || !Number.isInteger(price)) { setFormError('Price must be a whole number of cents.'); return; }

    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      durationMinutes: dur,
      priceCents: price,
      category: draft.category,
    };

    if (editId !== null) {
      updateService.mutate(
        { serviceId: editId, data: payload },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['app-services'] });
            qc.invalidateQueries({ queryKey: ['provider-application-completion'] });
            closeForm();
            setSaved(true);
          },
          onError: (err) => setFormError(apiError(err, 'Could not update service.')),
        },
      );
    } else {
      createService.mutate(
        { data: payload },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['app-services'] });
            qc.invalidateQueries({ queryKey: ['provider-application-completion'] });
            closeForm();
            setSaved(true);
          },
          onError: (err) => setFormError(apiError(err, 'Could not add service.')),
        },
      );
    }
  };

  const removeService = (id: number) => {
    setError('');
    deleteService.mutate(
      { serviceId: id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['app-services'] });
          qc.invalidateQueries({ queryKey: ['provider-application-completion'] });
        },
        onError: (err) => setError(apiError(err, 'Could not remove service.')),
      },
    );
  };

  return (
    <div>
      <h2 className="font-serif text-2xl font-bold text-foreground mb-1">Your services</h2>
      <p className="text-sm text-muted-foreground mb-6">Add the foot-care services you offer. You need at least one active service to submit your application.</p>

      {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {saved && !showForm && <div role="status" className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">Service saved ✓</div>}

      {servicesQuery.isLoading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : services.length === 0 && !showForm ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center mb-4">
          <p className="text-sm font-medium text-foreground mb-1">No services yet</p>
          <p className="text-xs text-muted-foreground mb-4">Add a service to let clients know what you offer.</p>
          <button type="button" onClick={openAdd} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Add your first service</button>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {services.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">{s.title}</p>
                {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>}
                <p className="text-xs text-muted-foreground mt-1">{s.durationMinutes} min · ${(s.priceCents / 100).toFixed(2)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => openEdit(s)} className="text-xs font-medium text-primary hover:underline">Edit</button>
                <button type="button" onClick={() => removeService(s.id)} disabled={busy} className="text-xs font-medium text-destructive hover:underline disabled:opacity-50">Remove</button>
              </div>
            </div>
          ))}
          {!showForm && (
            <button type="button" onClick={openAdd} className="w-full rounded-xl border border-dashed border-border px-4 py-3 text-sm font-medium text-primary hover:bg-card/50 transition-colors">
              + Add another service
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-4 space-y-4">
          <p className="font-semibold text-foreground">{editId !== null ? 'Edit service' : 'New service'}</p>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Service name <span className="text-destructive">*</span></span>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Foot Rejuvenation" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-primary focus:ring-2" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Description <span className="text-muted-foreground font-normal">(optional)</span></span>
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} placeholder="What does this service include?" className="w-full resize-y rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-primary focus:ring-2" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Duration (min) <span className="text-destructive">*</span></span>
              <input type="number" min={15} max={480} value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: e.target.value })} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-primary focus:ring-2" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Price (cents) <span className="text-destructive">*</span></span>
              <input type="number" min={0} value={draft.priceCents} onChange={(e) => setDraft({ ...draft, priceCents: e.target.value })} placeholder="8000 = $80.00" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-primary focus:ring-2" />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Price is in cents. Example: 8000 = $80.00 CAD</p>
          <div className="flex gap-2">
            <button type="button" onClick={closeForm} className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground">Cancel</button>
            <button type="button" onClick={saveService} disabled={createService.isPending || updateService.isPending} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {(createService.isPending || updateService.isPending) ? 'Saving…' : 'Save service'}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="rounded-xl border border-border bg-card px-4 py-3 font-semibold text-foreground">← Back</button>
        <button type="button" onClick={onNext} disabled={services.length === 0} className="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">
          {services.length === 0 ? 'Add a service to continue' : 'Save and continue →'}
        </button>
      </div>
    </div>
  );
}

// ── Availability step ─────────────────────────────────────────────────────────

interface AvailabilityStepProps {
  onNext: () => void;
  onBack: () => void;
}

type SlotDraft = { dayOfWeek: string; startTime: string; endTime: string };
const EMPTY_SLOT: SlotDraft = { dayOfWeek: '1', startTime: '09:00', endTime: '17:00' };

function AvailabilityStep({ onNext, onBack }: AvailabilityStepProps) {
  const availQuery = useGetApplicationAvailability({ query: { queryKey: ['app-availability'] } });
  const setAvailability = useSetApplicationAvailability();
  const qc = useQueryClient();

  const [slots, setSlots] = useState<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>([]);
  const [slotDraft, setSlotDraft] = useState<SlotDraft>(EMPTY_SLOT);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (availQuery.data?.slots && !loaded.current) {
      loaded.current = true;
      setSlots(availQuery.data.slots.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })));
    }
  }, [availQuery.data]);

  const addSlot = () => {
    setFormError('');
    const day = parseInt(slotDraft.dayOfWeek, 10);
    if (isNaN(day) || day < 0 || day > 6) { setFormError('Select a valid day.'); return; }
    if (slotDraft.startTime >= slotDraft.endTime) { setFormError('Start time must be before end time.'); return; }
    const newSlots = [...slots, { dayOfWeek: day, startTime: slotDraft.startTime, endTime: slotDraft.endTime }];
    saveSlots(newSlots, true);
  };

  const removeSlot = (i: number) => {
    const newSlots = slots.filter((_, idx) => idx !== i);
    saveSlots(newSlots, false);
  };

  const saveSlots = (newSlots: typeof slots, closing: boolean) => {
    setError('');
    setSaved(false);
    setAvailability.mutate(
      { data: { slots: newSlots } },
      {
        onSuccess: (data) => {
          qc.invalidateQueries({ queryKey: ['app-availability'] });
          qc.invalidateQueries({ queryKey: ['provider-application-completion'] });
          setSlots(data.slots.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })));
          if (closing) { setShowSlotForm(false); setSlotDraft(EMPTY_SLOT); }
          setSaved(true);
        },
        onError: (err) => setError(apiError(err, 'Could not save availability.')),
      },
    );
  };

  const applyWeekdayPreset = () => {
    const preset = [1, 2, 3, 4, 5].map((day) => ({ dayOfWeek: day, startTime: '09:00', endTime: '17:00' }));
    const weekend = slots.filter((s) => s.dayOfWeek === 0 || s.dayOfWeek === 6);
    saveSlots([...weekend, ...preset], false);
  };

  return (
    <div>
      <h2 className="font-serif text-2xl font-bold text-foreground mb-1">When are you available?</h2>
      <p className="text-sm text-muted-foreground mb-6">Add the days and hours you are typically available to see clients. You need at least one slot to submit.</p>

      {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {saved && !setAvailability.isPending && <div role="status" className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">Availability saved ✓</div>}

      {availQuery.isLoading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={applyWeekdayPreset} disabled={setAvailability.isPending} className="text-xs font-medium text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors disabled:opacity-50">
              Apply 9–5 weekdays preset
            </button>
          </div>

          {slots.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center mb-4">
              <p className="text-sm font-medium text-foreground mb-1">No availability yet</p>
              <p className="text-xs text-muted-foreground">Add a time slot or use the preset above.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {[...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)).map((slot, i) => {
                const origIdx = slots.findIndex((s) => s.dayOfWeek === slot.dayOfWeek && s.startTime === slot.startTime && s.endTime === slot.endTime);
                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
                    <span className="text-sm text-foreground font-medium">{DAY_NAMES[slot.dayOfWeek]}</span>
                    <span className="text-sm text-muted-foreground">{fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}</span>
                    <button type="button" onClick={() => removeSlot(origIdx)} disabled={setAvailability.isPending} className="text-xs text-destructive hover:underline disabled:opacity-50">Remove</button>
                  </div>
                );
              })}
            </div>
          )}

          {showSlotForm ? (
            <div className="rounded-2xl border border-border bg-card p-4 mb-4 space-y-3">
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Day of week</span>
                <select value={slotDraft.dayOfWeek} onChange={(e) => setSlotDraft({ ...slotDraft, dayOfWeek: e.target.value })} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-primary focus:ring-2">
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-foreground">Start time</span>
                  <input type="time" value={slotDraft.startTime} onChange={(e) => setSlotDraft({ ...slotDraft, startTime: e.target.value })} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-primary focus:ring-2" />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-foreground">End time</span>
                  <input type="time" value={slotDraft.endTime} onChange={(e) => setSlotDraft({ ...slotDraft, endTime: e.target.value })} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-primary focus:ring-2" />
                </label>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowSlotForm(false); setFormError(''); }} className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground">Cancel</button>
                <button type="button" onClick={addSlot} disabled={setAvailability.isPending} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {setAvailability.isPending ? 'Saving…' : 'Add slot'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setShowSlotForm(true); setFormError(''); }} className="w-full rounded-xl border border-dashed border-border px-4 py-3 text-sm font-medium text-primary hover:bg-card/50 transition-colors mb-4">
              + Add time slot
            </button>
          )}
        </>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="rounded-xl border border-border bg-card px-4 py-3 font-semibold text-foreground">← Back</button>
        <button type="button" onClick={onNext} disabled={slots.length === 0} className="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">
          {slots.length === 0 ? 'Add availability to continue' : 'Save and continue →'}
        </button>
      </div>
    </div>
  );
}

// ── Verification step ─────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: 'license', label: 'Professional license' },
  { value: 'insurance', label: 'Liability insurance' },
  { value: 'certification', label: 'Certification' },
  { value: 'other', label: 'Other credential' },
];

interface VerificationStepProps {
  onNext: () => void;
  onBack: () => void;
}

function VerificationStep({ onNext, onBack }: VerificationStepProps) {
  const verQuery = useGetMyVerification({ query: { queryKey: ['my-verification'] } });
  const submitDoc = useSubmitVerificationDoc();
  const qc = useQueryClient();

  const [docType, setDocType] = useState<SubmitVerificationDocRequestDocType>('license');
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);

  const docs = verQuery.data?.docs ?? [];

  const addDoc = () => {
    setFormError('');
    if (!fileName.trim() || fileName.trim().length < 3) {
      setFormError('Document reference must be at least 3 characters.');
      return;
    }
    submitDoc.mutate(
      { data: { docType, fileName: fileName.trim(), notes: notes.trim() || undefined } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['my-verification'] });
          qc.invalidateQueries({ queryKey: ['provider-application-completion'] });
          setFileName('');
          setNotes('');
          setShowForm(false);
          setSaved(true);
        },
        onError: (err) => setFormError(apiError(err, 'Could not submit document.')),
      },
    );
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Approved</span>;
    if (status === 'rejected') return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">Needs resubmission</span>;
    return <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">Pending review</span>;
  };

  return (
    <div>
      <h2 className="font-serif text-2xl font-bold text-foreground mb-1">Verification documents</h2>
      <p className="text-sm text-muted-foreground mb-2">Submit references to your credentials for our admin team to review. At least one document is required.</p>
      <p className="text-xs text-muted-foreground mb-6 bg-secondary/50 rounded-lg px-3 py-2">For security, we accept document references (e.g. a license number, issuing body, or document identifier). Our team will contact you if originals are needed.</p>

      {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {saved && !showForm && <div role="status" className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">Document submitted for review ✓</div>}

      {verQuery.isLoading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <>
          {docs.length > 0 && (
            <div className="space-y-2 mb-4">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground capitalize">{doc.docType.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 break-all">{doc.fileName}</p>
                  </div>
                  {statusBadge(doc.status)}
                </div>
              ))}
            </div>
          )}

          {docs.length === 0 && !showForm && (
            <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center mb-4">
              <p className="text-sm font-medium text-foreground mb-1">No documents submitted yet</p>
              <p className="text-xs text-muted-foreground">Add a reference to your professional license, insurance, or certification.</p>
            </div>
          )}

          {showForm ? (
            <div className="rounded-2xl border border-border bg-card p-4 mb-4 space-y-3">
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Document type</span>
                <select value={docType} onChange={(e) => setDocType(e.target.value as SubmitVerificationDocRequestDocType)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-primary focus:ring-2">
                  {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Document reference <span className="text-destructive">*</span></span>
                <input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="e.g. License #RPN-12345, issued by College of Nurses" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-primary focus:ring-2" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Notes for reviewer <span className="text-muted-foreground font-normal">(optional)</span></span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any context that helps our team verify this credential" className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-primary focus:ring-2" />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowForm(false); setFormError(''); }} className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground">Cancel</button>
                <button type="button" onClick={addDoc} disabled={submitDoc.isPending} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {submitDoc.isPending ? 'Submitting…' : 'Submit document'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setShowForm(true); setFormError(''); }} className="w-full rounded-xl border border-dashed border-border px-4 py-3 text-sm font-medium text-primary hover:bg-card/50 transition-colors mb-4">
              + Add document
            </button>
          )}
        </>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="rounded-xl border border-border bg-card px-4 py-3 font-semibold text-foreground">← Back</button>
        <button type="button" onClick={onNext} disabled={docs.length === 0} className="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">
          {docs.length === 0 ? 'Add a document to continue' : 'Save and continue →'}
        </button>
      </div>
    </div>
  );
}

// ── Review & Submit step ──────────────────────────────────────────────────────

interface ReviewStepProps {
  onBack: () => void;
  onGoToStep: (s: Step) => void;
}

function ReviewStep({ onBack, onGoToStep }: ReviewStepProps) {
  const completionQuery = useGetProviderApplicationCompletion({ query: { queryKey: ['provider-application-completion'] } });
  const submitApplication = useSubmitProviderApplication();
  const [, setLocation] = useLocation();
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const completion = completionQuery.data?.completion;
  const ready = completion?.readyForSubmission ?? false;

  const submit = () => {
    if (!confirmed) { setError('Please confirm before submitting.'); return; }
    setError('');
    submitApplication.mutate(undefined, {
      onSuccess: () => setLocation(ROUTES.provider.applicationStatus),
      onError: (err) => {
        const e = err as { data?: { error?: string; missingRequirements?: string[] } };
        const missing = e.data?.missingRequirements;
        setError(missing ? missing.join(', ') : apiError(err, 'Could not submit application.'));
      },
    });
  };

  const checkItem = (label: string, done: boolean | undefined, step: Step) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <span className={['flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', done ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'].join(' ')}>
        {done ? '✓' : '○'}
      </span>
      <span className="flex-1 text-sm text-foreground">{label}</span>
      {!done && (
        <button type="button" onClick={() => onGoToStep(step)} className="text-xs font-medium text-primary hover:underline">Complete</button>
      )}
    </div>
  );

  return (
    <div>
      <h2 className="font-serif text-2xl font-bold text-foreground mb-1">Review and submit</h2>
      <p className="text-sm text-muted-foreground mb-6">All sections must be complete before you can submit your application for review.</p>

      {completionQuery.isLoading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 mb-6">
          {checkItem('Professional profile (title, bio, city)', completion?.profileComplete, 'profile')}
          {checkItem('At least one service', completion?.servicesComplete, 'services')}
          {checkItem('At least one availability slot', completion?.availabilityComplete, 'availability')}
          {checkItem('At least one verification document', completion?.verificationComplete, 'verification')}
        </div>
      )}

      {ready && (
        <label className="flex items-start gap-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-sm text-foreground">
            I confirm that all information is accurate. I understand my application will be reviewed by the OnCall Foot team before I can accept bookings.
          </span>
        </label>
      )}

      {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

      <button
        type="button"
        onClick={() => setLocation(ROUTES.provider.listingPreview)}
        data-testid="onboarding-listing-preview-link"
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/50 transition-colors"
      >
        Preview your public listing
      </button>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="rounded-xl border border-border bg-card px-4 py-3 font-semibold text-foreground">← Back</button>
        <button
          type="button"
          onClick={submit}
          disabled={!ready || !confirmed || submitApplication.isPending}
          className="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitApplication.isPending ? 'Submitting…' : ready ? 'Submit for review' : 'Complete all sections first'}
        </button>
      </div>
    </div>
  );
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export default function ProviderOnboarding() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading, error: meError } = useGetMe();
  const canUseProviderOnboarding = Boolean(me?.user.roles?.includes('provider'));
  const applicationQuery = useGetProviderApplication({
    query: { enabled: Boolean(me?.user), retry: false, queryKey: ['provider-application'] },
  });
  const createApplication = useCreateProviderApplication();
  const completionQuery = useGetProviderApplicationCompletion({
    query: { enabled: canUseProviderOnboarding, queryKey: ['provider-application-completion'] },
  });

  const application = applicationQuery.data?.application;
  const [step, setStep] = useState<Step>('profile');
  const [initError, setInitError] = useState('');
  const startedRef = useRef(false);

  // Start onboarding for users without provider role
  useEffect(() => {
    if (!meLoading && (meError || !me?.user)) setLocation(ROUTES.login, { replace: true });
    if (me?.user && !canUseProviderOnboarding && !startedRef.current) {
      startedRef.current = true;
      createApplication.mutate(undefined, {
        onSuccess: () => applicationQuery.refetch(),
        onError: (err) => setInitError(apiError(err, 'We could not start provider onboarding.')),
      });
    }
  }, [applicationQuery, canUseProviderOnboarding, createApplication, me, meError, meLoading, setLocation]);

  // Redirect if already submitted/approved
  useEffect(() => {
    if (!application) return;
    if (application.status === 'under_review') setLocation(ROUTES.provider.applicationStatus, { replace: true });
    if (application.status === 'approved') setLocation(ROUTES.provider.root, { replace: true });
  }, [application, setLocation]);

  // Restore step from server currentStep when application first loads
  useEffect(() => {
    if (!application) return;
    const serverStep = application.currentStep as string;
    if ((STEPS as string[]).includes(serverStep)) setStep(serverStep as Step);
  }, [application?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const completion = useMemo(() => {
    const c = completionQuery.data?.completion;
    return {
      profile: c?.profileComplete ?? false,
      services: c?.servicesComplete ?? false,
      availability: c?.availabilityComplete ?? false,
      verification: c?.verificationComplete ?? false,
      review: c?.readyForSubmission ?? false,
    };
  }, [completionQuery.data]);

  const goNext = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };
  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  if (meLoading || applicationQuery.isLoading || createApplication.isPending || !application) {
    return (
      <main className="min-h-[100dvh] bg-background flex items-center justify-center px-6">
        {initError ? (
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{initError}</p>
            <button onClick={() => setLocation(ROUTES.client.discover)} className="text-sm text-primary underline">Back to discover</button>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Preparing your provider workspace…</p>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background px-5 py-8">
      <div className="mx-auto w-full max-w-[600px]">
        <div className="mb-6">
          <p className="mb-1 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Provider onboarding</p>
          <h1 className="font-serif text-3xl font-bold text-foreground">Build your provider profile</h1>
        </div>

        <ProgressBar steps={STEPS} current={step} completion={completion} onNavigate={setStep} />

        {step === 'profile' && (
          <ProfileStep application={application} onNext={goNext} />
        )}
        {step === 'services' && (
          <ServicesStep onNext={goNext} onBack={goBack} />
        )}
        {step === 'availability' && (
          <AvailabilityStep onNext={goNext} onBack={goBack} />
        )}
        {step === 'verification' && (
          <VerificationStep onNext={goNext} onBack={goBack} />
        )}
        {step === 'review' && (
          <ReviewStep onBack={goBack} onGoToStep={setStep} />
        )}

        <button
          type="button"
          onClick={() => setLocation(ROUTES.client.discover)}
          className="mt-8 w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Return to client experience
        </button>
      </div>
    </main>
  );
}
