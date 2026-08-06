import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  useCreateApplicationService,
  useCreateProviderApplication,
  useDeleteApplicationService,
  useGetApplicationAvailability,
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
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/auth';

// ── helpers ──────────────────────────────────────────────────────────────────

function apiError(error: unknown, fallback: string): string {
  const r = error as { response?: { data?: { error?: string } } };
  return r.response?.data?.error ?? fallback;
}

type Step = 'profile' | 'services' | 'availability' | 'verification' | 'review';
const STEPS: Step[] = ['profile', 'services', 'availability', 'verification', 'review'];
const STEP_LABELS: Record<Step, string> = {
  profile: 'Profile',
  services: 'Services',
  availability: 'Availability',
  verification: 'Verification',
  review: 'Review',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DOC_TYPES = ['license', 'insurance', 'certification', 'other'] as const;
type DocType = typeof DOC_TYPES[number];

function fmtTime(t: string) {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h < 12 ? 'AM' : 'PM';
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${mStr} ${ampm}`;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({
  steps,
  current,
  completion,
  onNavigate,
  colors,
}: {
  steps: Step[];
  current: Step;
  completion: Record<Step, boolean>;
  onNavigate: (s: Step) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.progressContainer}>
      {steps.map((step, i) => {
        const done = completion[step];
        const active = step === current;
        return (
          <React.Fragment key={step}>
            <Pressable onPress={() => onNavigate(step)} style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  {
                    backgroundColor: done ? colors.primary : active ? colors.card : colors.secondary,
                    borderColor: done || active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.stepCircleText, { color: done ? '#fff' : active ? colors.primary : colors.mutedForeground }]}>
                  {done ? '✓' : String(i + 1)}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  { color: active ? colors.foreground : colors.mutedForeground },
                ]}
                numberOfLines={1}
              >
                {STEP_LABELS[step]}
              </Text>
            </Pressable>
            {i < steps.length - 1 && (
              <View style={[styles.stepConnector, { backgroundColor: done ? colors.primary : colors.border }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ── Field component ────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  required,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'numeric' | 'number-pad';
  required?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>
        {label}
        {required && <Text style={{ color: colors.destructive }}> *</Text>}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={multiline ? 2000 : 120}
        style={[
          styles.input,
          multiline && styles.textArea,
          { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

// ── Profile step ──────────────────────────────────────────────────────────────

function ProfileStep({
  application,
  onNext,
  colors,
}: {
  application: { profile: { title: string; bio: string | null; city: string; yearsExperience: number | null }; status: string };
  onNext: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [title, setTitle] = useState(application.profile.title);
  const [bio, setBio] = useState(application.profile.bio ?? '');
  const [city, setCity] = useState(application.profile.city);
  const [years, setYears] = useState(application.profile.yearsExperience?.toString() ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const update = useUpdateProviderApplication();
  const qc = useQueryClient();

  const save = (andContinue: boolean) => {
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
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Professional profile</Text>
      <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>Tell clients who you are and where you work.</Text>
      {!!error && <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}
      {saved && <Text style={[styles.savedText, { color: colors.primary }]}>Profile saved ✓</Text>}
      <Field label="Professional title" value={title} onChangeText={setTitle} placeholder="Certified mobile foot-care specialist" required colors={colors} />
      <Field label="Short bio" value={bio} onChangeText={setBio} placeholder="Tell clients what kind of care you provide." multiline required colors={colors} />
      <View style={styles.row}>
        <View style={styles.rowHalf}>
          <Field label="Primary city" value={city} onChangeText={setCity} placeholder="Austin" required colors={colors} />
        </View>
        <View style={styles.rowHalf}>
          <Field label="Years of experience" value={years} onChangeText={setYears} placeholder="Optional" keyboardType="number-pad" colors={colors} />
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => save(false)} disabled={update.isPending} style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card, opacity: update.isPending ? 0.6 : 1 }]} activeOpacity={0.8}>
          <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>{update.isPending ? 'Saving…' : 'Save for later'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => save(true)} disabled={update.isPending} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: update.isPending ? 0.6 : 1 }]} activeOpacity={0.8}>
          {update.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Continue →</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Services step ─────────────────────────────────────────────────────────────

type ServiceDraft = { title: string; description: string; durationMinutes: string; priceCents: string };
const EMPTY_SERVICE: ServiceDraft = { title: '', description: '', durationMinutes: '60', priceCents: '8000' };

function ServicesStep({
  onNext,
  onBack,
  colors,
}: {
  onNext: () => void;
  onBack: () => void;
  colors: ReturnType<typeof useColors>;
}) {
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

  const services = servicesQuery.data?.services ?? [];
  const busy = createService.isPending || updateService.isPending || deleteService.isPending;

  const openAdd = () => { setDraft(EMPTY_SERVICE); setEditId(null); setFormError(''); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditId(null); setFormError(''); };

  const openEdit = (s: typeof services[0]) => {
    setDraft({ title: s.title, description: s.description ?? '', durationMinutes: String(s.durationMinutes), priceCents: String(s.priceCents) });
    setEditId(s.id);
    setFormError('');
    setShowForm(true);
  };

  const saveService = () => {
    setFormError('');
    if (!draft.title.trim()) { setFormError('Service name is required.'); return; }
    const dur = Number(draft.durationMinutes);
    if (!dur || dur < 15) { setFormError('Duration must be at least 15 minutes.'); return; }
    const price = Number(draft.priceCents);
    if (price < 0) { setFormError('Price must be non-negative.'); return; }
    const payload = { title: draft.title.trim(), description: draft.description.trim() || undefined, durationMinutes: dur, priceCents: price, category: 'foot_care' };
    const onSuccess = () => { qc.invalidateQueries({ queryKey: ['app-services'] }); qc.invalidateQueries({ queryKey: ['provider-application-completion'] }); closeForm(); };
    const onError = (err: unknown) => setFormError(apiError(err, 'Could not save service.'));
    if (editId !== null) {
      updateService.mutate({ serviceId: editId, data: payload }, { onSuccess, onError });
    } else {
      createService.mutate({ data: payload }, { onSuccess, onError });
    }
  };

  const removeService = (id: number) => {
    deleteService.mutate({ serviceId: id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: ['app-services'] }); qc.invalidateQueries({ queryKey: ['provider-application-completion'] }); },
      onError: (err) => setError(apiError(err, 'Could not remove service.')),
    });
  };

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Your services</Text>
      <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>Add at least one service to continue.</Text>
      {!!error && <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}

      {servicesQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
      ) : (
        <>
          {services.length === 0 && !showForm && (
            <View style={[styles.emptyBox, { borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No services yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Add a service to let clients know what you offer.</Text>
            </View>
          )}
          {services.map((s) => (
            <View key={s.id} style={[styles.itemCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.itemTitle, { color: colors.foreground }]}>{s.title}</Text>
                <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>{s.durationMinutes} min · ${(s.priceCents / 100).toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => openEdit(s)}><Text style={[styles.linkBtn, { color: colors.primary }]}>Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => removeService(s.id)} disabled={busy}><Text style={[styles.linkBtn, { color: colors.destructive, opacity: busy ? 0.5 : 1 }]}>Remove</Text></TouchableOpacity>
              </View>
            </View>
          ))}
          {!showForm && (
            <TouchableOpacity onPress={openAdd} style={[styles.dashedButton, { borderColor: colors.border }]} activeOpacity={0.8}>
              <Text style={[styles.dashedButtonText, { color: colors.primary }]}>+ Add {services.length > 0 ? 'another' : 'a'} service</Text>
            </TouchableOpacity>
          )}
          {showForm && (
            <View style={[styles.formCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.formTitle, { color: colors.foreground }]}>{editId !== null ? 'Edit service' : 'New service'}</Text>
              {!!formError && <Text style={[styles.errorText, { color: colors.destructive }]}>{formError}</Text>}
              <Field label="Service name" value={draft.title} onChangeText={(v) => setDraft({ ...draft, title: v })} required colors={colors} />
              <Field label="Description (optional)" value={draft.description} onChangeText={(v) => setDraft({ ...draft, description: v })} placeholder="What does this service include?" multiline colors={colors} />
              <View style={styles.row}>
                <View style={styles.rowHalf}>
                  <Field label="Duration (min)" value={draft.durationMinutes} onChangeText={(v) => setDraft({ ...draft, durationMinutes: v })} keyboardType="numeric" required colors={colors} />
                </View>
                <View style={styles.rowHalf}>
                  <Field label="Price (cents)" value={draft.priceCents} onChangeText={(v) => setDraft({ ...draft, priceCents: v })} keyboardType="numeric" required colors={colors} />
                </View>
              </View>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>Price in cents: 8000 = $80.00 CAD</Text>
              <View style={styles.actions}>
                <TouchableOpacity onPress={closeForm} style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.background }]} activeOpacity={0.8}>
                  <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveService} disabled={busy} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]} activeOpacity={0.8}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save service</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}

      <View style={[styles.actions, { marginTop: 16 }]}>
        <TouchableOpacity onPress={onBack} style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]} activeOpacity={0.8}>
          <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} disabled={services.length === 0} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: services.length === 0 ? 0.4 : 1 }]} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>{services.length === 0 ? 'Add a service' : 'Continue →'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Availability step ─────────────────────────────────────────────────────────

function AvailabilityStep({
  onNext,
  onBack,
  colors,
}: {
  onNext: () => void;
  onBack: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const availQuery = useGetApplicationAvailability({ query: { queryKey: ['app-availability'] } });
  const setAvailMutation = useSetApplicationAvailability();
  const qc = useQueryClient();

  const [slots, setSlots] = useState<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [dayIndex, setDayIndex] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
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

  const saveSlots = (newSlots: typeof slots, closing: boolean) => {
    setError('');
    setSaved(false);
    setAvailMutation.mutate(
      { data: { slots: newSlots } },
      {
        onSuccess: (data) => {
          qc.invalidateQueries({ queryKey: ['app-availability'] });
          qc.invalidateQueries({ queryKey: ['provider-application-completion'] });
          setSlots(data.slots.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })));
          if (closing) { setShowForm(false); }
          setSaved(true);
        },
        onError: (err) => setError(apiError(err, 'Could not save availability.')),
      },
    );
  };

  const addSlot = () => {
    setFormError('');
    if (startTime >= endTime) { setFormError('Start time must be before end time.'); return; }
    saveSlots([...slots, { dayOfWeek: dayIndex, startTime, endTime }], true);
  };

  const removeSlot = (i: number) => saveSlots(slots.filter((_, idx) => idx !== i), false);

  const applyPreset = () => {
    const preset = [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '17:00' }));
    const weekend = slots.filter((s) => s.dayOfWeek === 0 || s.dayOfWeek === 6);
    saveSlots([...weekend, ...preset], false);
  };

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>When are you available?</Text>
      <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>Add at least one slot to continue.</Text>
      {!!error && <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}
      {saved && !setAvailMutation.isPending && <Text style={[styles.savedText, { color: colors.primary }]}>Availability saved ✓</Text>}

      <TouchableOpacity onPress={applyPreset} disabled={setAvailMutation.isPending} style={[styles.presetButton, { borderColor: colors.primary + '50' }]} activeOpacity={0.8}>
        <Text style={[styles.presetButtonText, { color: colors.primary, opacity: setAvailMutation.isPending ? 0.5 : 1 }]}>Apply 9–5 weekdays preset</Text>
      </TouchableOpacity>

      {availQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
      ) : slots.length === 0 && !showForm ? (
        <View style={[styles.emptyBox, { borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No slots yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Add a time slot or use the preset above.</Text>
        </View>
      ) : (
        [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)).map((slot, i) => {
          const origIdx = slots.findIndex((s) => s.dayOfWeek === slot.dayOfWeek && s.startTime === slot.startTime && s.endTime === slot.endTime);
          return (
            <View key={i} style={[styles.itemCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.itemTitle, { color: colors.foreground }]}>{DAY_NAMES_FULL[slot.dayOfWeek]}</Text>
              <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>{fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}</Text>
              <TouchableOpacity onPress={() => removeSlot(origIdx)} disabled={setAvailMutation.isPending}>
                <Text style={[styles.linkBtn, { color: colors.destructive, opacity: setAvailMutation.isPending ? 0.5 : 1 }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {!showForm ? (
        <TouchableOpacity onPress={() => { setShowForm(true); setFormError(''); }} style={[styles.dashedButton, { borderColor: colors.border }]} activeOpacity={0.8}>
          <Text style={[styles.dashedButtonText, { color: colors.primary }]}>+ Add time slot</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.formCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {!!formError && <Text style={[styles.errorText, { color: colors.destructive }]}>{formError}</Text>}
          <Text style={[styles.label, { color: colors.foreground }]}>Day of week</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {DAY_NAMES.map((d, i) => (
              <TouchableOpacity key={i} onPress={() => setDayIndex(i)} style={[styles.dayChip, { backgroundColor: dayIndex === i ? colors.primary : colors.secondary, marginRight: 8 }]}>
                <Text style={[styles.dayChipText, { color: dayIndex === i ? '#fff' : colors.foreground }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <Text style={[styles.label, { color: colors.foreground }]}>Start time</Text>
              <TextInput value={startTime} onChangeText={setStartTime} placeholder="09:00" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
            </View>
            <View style={styles.rowHalf}>
              <Text style={[styles.label, { color: colors.foreground }]}>End time</Text>
              <TextInput value={endTime} onChangeText={setEndTime} placeholder="17:00" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
            </View>
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Use 24h format (e.g. 09:00, 17:00)</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => { setShowForm(false); setFormError(''); }} style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.background }]} activeOpacity={0.8}>
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={addSlot} disabled={setAvailMutation.isPending} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: setAvailMutation.isPending ? 0.6 : 1 }]} activeOpacity={0.8}>
              {setAvailMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Add slot</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.actions, { marginTop: 16 }]}>
        <TouchableOpacity onPress={onBack} style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]} activeOpacity={0.8}>
          <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} disabled={slots.length === 0} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: slots.length === 0 ? 0.4 : 1 }]} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>{slots.length === 0 ? 'Add availability' : 'Continue →'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Verification step ─────────────────────────────────────────────────────────

function VerificationStep({
  onNext,
  onBack,
  colors,
}: {
  onNext: () => void;
  onBack: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const verQuery = useGetMyVerification({ query: { queryKey: ['my-verification'] } });
  const submitDoc = useSubmitVerificationDoc();
  const qc = useQueryClient();

  const [docType, setDocType] = useState<DocType>('license');
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);

  const docs = verQuery.data?.docs ?? [];

  const addDoc = () => {
    setFormError('');
    if (!fileName.trim() || fileName.trim().length < 3) { setFormError('Document reference must be at least 3 characters.'); return; }
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

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Verification documents</Text>
      <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>Submit a reference to your credentials. At least one document is required.</Text>
      <View style={[styles.infoBanner, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>Submit a license number, issuing body, or document identifier. Our team will follow up if originals are needed.</Text>
      </View>
      {saved && !showForm && <Text style={[styles.savedText, { color: colors.primary }]}>Document submitted ✓</Text>}

      {verQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
      ) : (
        <>
          {docs.length === 0 && !showForm && (
            <View style={[styles.emptyBox, { borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No documents yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Add a reference to your professional credential.</Text>
            </View>
          )}
          {docs.map((doc) => (
            <View key={doc.id} style={[styles.itemCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: colors.foreground }]}>{doc.docType}</Text>
                <Text style={[styles.itemMeta, { color: colors.mutedForeground }]} numberOfLines={1}>{doc.fileName}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: doc.status === 'approved' ? '#d1fae5' : doc.status === 'rejected' ? '#fee2e2' : '#fef3c7' }]}>
                <Text style={[styles.statusBadgeText, { color: doc.status === 'approved' ? '#065f46' : doc.status === 'rejected' ? '#991b1b' : '#92400e' }]}>
                  {doc.status}
                </Text>
              </View>
            </View>
          ))}
          {!showForm && (
            <TouchableOpacity onPress={() => { setShowForm(true); setFormError(''); }} style={[styles.dashedButton, { borderColor: colors.border }]} activeOpacity={0.8}>
              <Text style={[styles.dashedButtonText, { color: colors.primary }]}>+ Add document</Text>
            </TouchableOpacity>
          )}
          {showForm && (
            <View style={[styles.formCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              {!!formError && <Text style={[styles.errorText, { color: colors.destructive }]}>{formError}</Text>}
              <Text style={[styles.label, { color: colors.foreground }]}>Document type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {DOC_TYPES.map((t) => (
                  <TouchableOpacity key={t} onPress={() => setDocType(t)} style={[styles.typeChip, { backgroundColor: docType === t ? colors.primary : colors.secondary }]}>
                    <Text style={[styles.typeChipText, { color: docType === t ? '#fff' : colors.foreground }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="Document reference" value={fileName} onChangeText={setFileName} placeholder="e.g. License #RPN-12345, College of Nurses" required colors={colors} />
              <Field label="Notes for reviewer (optional)" value={notes} onChangeText={setNotes} placeholder="Any context that helps verify this credential" multiline colors={colors} />
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => { setShowForm(false); setFormError(''); }} style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.background }]} activeOpacity={0.8}>
                  <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={addDoc} disabled={submitDoc.isPending} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: submitDoc.isPending ? 0.6 : 1 }]} activeOpacity={0.8}>
                  {submitDoc.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Submit</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}

      <View style={[styles.actions, { marginTop: 16 }]}>
        <TouchableOpacity onPress={onBack} style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]} activeOpacity={0.8}>
          <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} disabled={docs.length === 0} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: docs.length === 0 ? 0.4 : 1 }]} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>{docs.length === 0 ? 'Add a document' : 'Continue →'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Review step ────────────────────────────────────────────────────────────────

function ReviewStep({
  onBack,
  onGoToStep,
  colors,
}: {
  onBack: () => void;
  onGoToStep: (s: Step) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const completionQuery = useGetProviderApplicationCompletion({ query: { queryKey: ['provider-application-completion'] } });
  const submitApplication = useSubmitProviderApplication();
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const completion = completionQuery.data?.completion;
  const ready = completion?.readyForSubmission ?? false;

  const submit = () => {
    if (!confirmed) { setError('Please confirm before submitting.'); return; }
    setError('');
    submitApplication.mutate(undefined, {
      onSuccess: () => router.replace('/provider/application-status'),
      onError: (err) => {
        const e = err as { response?: { data?: { missingRequirements?: string[] } } };
        const missing = e.response?.data?.missingRequirements;
        setError(missing ? missing.join(', ') : apiError(err, 'Could not submit application.'));
      },
    });
  };

  const CheckRow = ({ label, done, step }: { label: string; done: boolean | undefined; step: Step }) => (
    <View style={styles.checkRow}>
      <View style={[styles.checkCircle, { backgroundColor: done ? colors.primary : colors.secondary }]}>
        <Text style={[styles.checkCircleText, { color: done ? '#fff' : colors.mutedForeground }]}>{done ? '✓' : '○'}</Text>
      </View>
      <Text style={[styles.checkLabel, { color: colors.foreground, flex: 1 }]}>{label}</Text>
      {!done && (
        <TouchableOpacity onPress={() => onGoToStep(step)}>
          <Text style={[styles.linkBtn, { color: colors.primary }]}>Complete</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Review & submit</Text>
      <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>All sections must be complete before submitting.</Text>

      {completionQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
      ) : (
        <View style={[styles.checkCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <CheckRow label="Professional profile (title, bio, city)" done={completion?.profileComplete} step="profile" />
          <CheckRow label="At least one service" done={completion?.servicesComplete} step="services" />
          <CheckRow label="At least one availability slot" done={completion?.availabilityComplete} step="availability" />
          <CheckRow label="At least one verification document" done={completion?.verificationComplete} step="verification" />
        </View>
      )}

      {ready && (
        <TouchableOpacity onPress={() => setConfirmed((c) => !c)} style={styles.confirmRow} activeOpacity={0.8}>
          <View style={[styles.checkboxBox, { borderColor: confirmed ? colors.primary : colors.border, backgroundColor: confirmed ? colors.primary : colors.card }]}>
            {confirmed && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
          </View>
          <Text style={[styles.confirmText, { color: colors.foreground, flex: 1 }]}>
            I confirm all information is accurate. I understand my application will be reviewed before I can accept bookings.
          </Text>
        </TouchableOpacity>
      )}

      {!!error && <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}

      <View style={[styles.actions, { marginTop: 16 }]}>
        <TouchableOpacity onPress={onBack} style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]} activeOpacity={0.8}>
          <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={submit}
          disabled={!ready || !confirmed || submitApplication.isPending}
          style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: (!ready || !confirmed || submitApplication.isPending) ? 0.4 : 1 }]}
          activeOpacity={0.8}
        >
          {submitApplication.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{ready ? 'Submit for review' : 'Complete all sections'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function ProviderOnboardingScreen() {
  const colors = useColors();
  const { user, isLoading: authLoading } = useAuth();
  const hasProviderRole = Boolean(user?.roles?.includes('provider') || user?.role === 'provider');
  const applicationQuery = useGetProviderApplication({
    query: { enabled: hasProviderRole, retry: false, queryKey: ['provider-application'] },
  });
  const completionQuery = useGetProviderApplicationCompletion({
    query: { enabled: hasProviderRole, queryKey: ['provider-application-completion'] },
  });
  const createApplication = useCreateProviderApplication();
  const startedRef = useRef(false);
  const [step, setStep] = useState<Step>('profile');
  const [initError, setInitError] = useState('');

  const application = applicationQuery.data?.application;

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
    if (user && !hasProviderRole && !startedRef.current) {
      startedRef.current = true;
      createApplication.mutate(undefined, {
        onSuccess: () => applicationQuery.refetch(),
        onError: (err) => setInitError(apiError(err, 'We could not start provider onboarding.')),
      });
    }
  }, [authLoading, createApplication, hasProviderRole, user, applicationQuery]);

  useEffect(() => {
    if (!application) return;
    if (application.status === 'approved') router.replace('/(tabs)/account');
    if (application.status === 'under_review') router.replace('/provider/application-status');
  }, [application]);

  // Restore step from server
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

  const goNext = () => { const idx = STEPS.indexOf(step); if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]); };
  const goBack = () => { const idx = STEPS.indexOf(step); if (idx > 0) setStep(STEPS[idx - 1]); };

  if (authLoading || applicationQuery.isLoading || createApplication.isPending || !application) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {initError ? (
          <>
            <Text style={[styles.errorText, { color: colors.destructive }]}>{initError}</Text>
            <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 14 }}>Back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Preparing your provider workspace…</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: colors.primary }]}>PROVIDER ONBOARDING</Text>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Build your provider profile</Text>

        <ProgressBar steps={STEPS} current={step} completion={completion} onNavigate={setStep} colors={colors} />

        {step === 'profile' && <ProfileStep application={application} onNext={goNext} colors={colors} />}
        {step === 'services' && <ServicesStep onNext={goNext} onBack={goBack} colors={colors} />}
        {step === 'availability' && <AvailabilityStep onNext={goNext} onBack={goBack} colors={colors} />}
        {step === 'verification' && <VerificationStep onNext={goNext} onBack={goBack} colors={colors} />}
        {step === 'review' && <ReviewStep onBack={goBack} onGoToStep={setStep} colors={colors} />}

        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.returnButton}>
          <Text style={[styles.returnText, { color: colors.mutedForeground }]}>Return to client experience</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4, marginBottom: 8 },
  screenTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, lineHeight: 33, marginBottom: 22 },
  loadingText: { fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 10 },

  // Progress
  progressContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepCircleText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  stepLabel: { fontFamily: 'Inter_500Medium', fontSize: 9, textAlign: 'center' },
  stepConnector: { height: 2, width: 10, marginBottom: 18 },

  // Step content
  stepTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28, marginBottom: 6 },
  stepSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  savedText: { fontFamily: 'Inter_500Medium', fontSize: 13, marginBottom: 12 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 4 },

  // Field
  field: { marginBottom: 14 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 7 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 14 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  // Actions
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryButton: { flex: 1, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryButtonText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  secondaryButton: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  secondaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  // Cards/items
  itemCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 8, gap: 10 },
  itemTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  itemMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  linkBtn: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  formCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  formTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 12 },
  emptyBox: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 4 },
  emptySubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center' },
  dashedButton: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  dashedButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  // Layout
  row: { flexDirection: 'row', gap: 12 },
  rowHalf: { flex: 1 },

  // Preset
  presetButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 12 },
  presetButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  // Day chips
  dayChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  dayChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  // Type chips
  typeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  typeChipText: { fontFamily: 'Inter_500Medium', fontSize: 12 },

  // Status badge
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, textTransform: 'capitalize' },

  // Info banner
  infoBanner: { borderRadius: 10, padding: 10, marginBottom: 14 },
  infoText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },

  // Check row (review)
  checkCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkCircleText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  checkLabel: { fontFamily: 'Inter_400Regular', fontSize: 13 },

  // Confirm
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  checkboxBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  confirmText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },

  // Return
  returnButton: { alignItems: 'center', paddingVertical: 22 },
  returnText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});
