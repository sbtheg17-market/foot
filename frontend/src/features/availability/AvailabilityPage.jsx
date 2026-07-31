import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, MapPin } from "lucide-react";
import { Button } from "../../components/ui/button";
import { formatApiErrorDetail } from "../../lib/api";
import { WeeklyEditor, weeklyIsValid } from "./WeeklyEditor";
import { TravelZoneEditor } from "./TravelZoneEditor";
import { useAvailability, useUpdateAvailability } from "./hooks";

const emptyWeekly = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
const emptyTravel = { mode: "radius", radius_km: 20, home_address: "", pincodes: [] };

const SectionHeader = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-start gap-3 mb-4">
    <div className="h-11 w-11 rounded-xl bg-secondary text-primary flex items-center justify-center shrink-0">
      <Icon size={20} />
    </div>
    <div>
      <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  </div>
);

export default function AvailabilityPage() {
  const { data, isLoading } = useAvailability();
  const update = useUpdateAvailability();
  const [weekly, setWeekly] = useState(emptyWeekly);
  const [travel, setTravel] = useState(emptyTravel);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data && !dirty) {
      setWeekly({ ...emptyWeekly, ...(data.weekly || {}) });
      setTravel({ ...emptyTravel, ...(data.travel || {}) });
    }
  }, [data, dirty]);

  const setWeeklyDirty = (v) => {
    setDirty(true);
    setWeekly(v);
  };
  const setTravelDirty = (v) => {
    setDirty(true);
    setTravel(v);
  };

  const save = async () => {
    if (!weeklyIsValid(weekly)) {
      return toast.error("Some slots have end before start. Please fix them first.");
    }
    try {
      await update.mutateAsync({ weekly, travel });
      toast.success("Availability saved");
      setDirty(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Schedule
          </p>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Where & when</h1>
        </div>
        <Button
          onClick={save}
          disabled={!dirty || update.isPending}
          className="h-11 rounded-full px-5 font-semibold active:scale-95 transition-transform duration-200"
          data-testid="availability-save-btn"
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </header>

      <main className="px-5 py-6 space-y-8" data-testid="availability-page">
        {isLoading ? (
          <div className="rounded-2xl bg-card border border-black/5 p-6 animate-pulse space-y-3">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-2/3 bg-muted rounded" />
          </div>
        ) : (
          <>
            <section>
              <SectionHeader
                icon={Clock}
                title="Weekly hours"
                subtitle="Set the recurring hours you're available for home visits."
              />
              <WeeklyEditor value={weekly} onChange={setWeeklyDirty} />
            </section>

            <section>
              <SectionHeader
                icon={MapPin}
                title="Travel zone"
                subtitle="Choose how far you'll travel for a visit."
              />
              <TravelZoneEditor value={travel} onChange={setTravelDirty} />
            </section>

            {dirty && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground" data-testid="availability-dirty-hint">
                You have unsaved changes.
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
