import React, { useState, useEffect } from 'react';
import { useGetMyAvailability, useSetMyAvailability, AvailabilitySlot } from '@workspace/api-client-react';
import { Plus, Trash2, Save, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import EmergencyOpeningsSection from '@/components/emergency-openings-section';
import BlockedRangesSection from '@/components/blocked-ranges-section';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS = [1, 2, 3, 4, 5]; // Monday–Friday

/** Weekday 9–5 preset: replaces Mon–Fri with a single 09:00–17:00 slot each; weekend slots are preserved. Idempotent. */
export function applyWeekdayPreset(
  slots: { dayOfWeek: number; startTime: string; endTime: string }[]
): { dayOfWeek: number; startTime: string; endTime: string }[] {
  const weekendSlots = slots.filter(s => !WEEKDAYS.includes(s.dayOfWeek));
  const weekdaySlots = WEEKDAYS.map(dayOfWeek => ({ dayOfWeek, startTime: '09:00', endTime: '17:00' }));
  return [...weekendSlots, ...weekdaySlots];
}

export default function PortalAvailability() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetMyAvailability({
    query: { queryKey: ['my-availability'] }
  });
  
  const setAvailability = useSetMyAvailability();

  // Local state for edits
  const [slots, setSlots] = useState<{ dayOfWeek: number, startTime: string, endTime: string, id?: number }[]>([]);
  
  useEffect(() => {
    if (data?.slots) {
      setSlots(data.slots);
    }
  }, [data]);

  const addSlot = (dayIdx: number) => {
    setSlots([...slots, { dayOfWeek: dayIdx, startTime: '09:00', endTime: '17:00' }]);
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: 'startTime'|'endTime', value: string) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setSlots(newSlots);
  };

  // Reuses the single existing save path for both manual saves and the preset.
  const saveSlots = (
    slotsToSave: { dayOfWeek: number; startTime: string; endTime: string }[],
    successMessage: string,
  ) => {
    const payload = slotsToSave.map(s => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime
    }));

    setAvailability.mutate({ data: { slots: payload } }, {
      onSuccess: () => {
        toast.success(successMessage);
        queryClient.invalidateQueries({ queryKey: ['my-availability'] });
      },
      onError: () => {
        toast.error('Failed to save schedule');
      }
    });
  };

  const handleSave = () => saveSlots(slots, 'Schedule saved successfully');

  const handlePreset = () => {
    if (setAvailability.isPending) return;
    const next = applyWeekdayPreset(slots);
    setSlots(next);
    saveSlots(next, 'Weekday 9–5 schedule applied');
  };

  if (isLoading) {
    return <div className="p-6 pt-20 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="p-6 pt-10 pb-32 max-w-4xl mx-auto flex flex-col h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Schedule</h1>
          <p className="text-muted-foreground mt-1 text-sm">Set your working hours.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={setAvailability.isPending}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold shadow-sm flex items-center gap-2 hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {setAvailability.isPending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <><Save className="w-4 h-4" /> Save</>
          )}
        </button>
      </div>

      <button
        onClick={handlePreset}
        disabled={setAvailability.isPending}
        data-testid="availability-preset-9-5-btn"
        className="mb-6 w-full sm:w-auto self-start bg-secondary text-secondary-foreground border border-border px-5 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors active:scale-[0.98] disabled:opacity-50"
      >
        <Zap className="w-4 h-4" />
        Apply 9–5 weekdays preset
      </button>

      <div className="space-y-6">
        {DAYS.map((dayName, dayIdx) => {
          const daySlots = slots.map((s, idx) => ({...s, originalIndex: idx})).filter(s => s.dayOfWeek === dayIdx);
          const hasSlots = daySlots.length > 0;

          return (
            <div key={dayIdx} className="bg-card border border-border rounded-3xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif font-semibold text-lg flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${hasSlots ? 'bg-primary' : 'bg-muted'}`} />
                  {dayName}
                </h3>
                <button 
                  onClick={() => addSlot(dayIdx)}
                  className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {hasSlots ? (
                <div className="space-y-3">
                  {daySlots.map(slot => (
                    <div key={slot.originalIndex} className="flex items-center gap-3 bg-secondary/50 p-3 rounded-2xl border border-border/50">
                      <input 
                        type="time" 
                        value={slot.startTime} 
                        onChange={(e) => updateSlot(slot.originalIndex, 'startTime', e.target.value)}
                        className="bg-card border border-border px-3 py-2 rounded-xl text-sm font-medium w-full outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                      <span className="text-muted-foreground text-sm font-medium">to</span>
                      <input 
                        type="time" 
                        value={slot.endTime} 
                        onChange={(e) => updateSlot(slot.originalIndex, 'endTime', e.target.value)}
                        className="bg-card border border-border px-3 py-2 rounded-xl text-sm font-medium w-full outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                      <button 
                        onClick={() => removeSlot(slot.originalIndex)}
                        className="text-muted-foreground hover:text-destructive p-2 rounded-xl hover:bg-destructive/10 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm font-medium text-muted-foreground bg-secondary/30 rounded-2xl py-4 text-center border border-dashed border-border">
                  Not available
                </div>
              )}
            </div>
          );
        })}
      </div>

      <EmergencyOpeningsSection />

      <BlockedRangesSection />
    </div>
  );
}
