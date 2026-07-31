import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../../components/ui/sheet";
import { formatApiErrorDetail } from "../../lib/api";
import { SERVICE_CATEGORIES } from "../../lib/serviceCategories";
import { useCreateService, useUpdateService } from "./hooks";

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

const emptyForm = {
  name: "",
  description: "",
  category: "",
  duration_minutes: 45,
  price_dollars: "",
  active: true,
};

const toForm = (svc) =>
  svc
    ? {
        name: svc.name || "",
        description: svc.description || "",
        category: svc.category || "",
        duration_minutes: svc.duration_minutes || 45,
        price_dollars: ((svc.price_cents || 0) / 100).toFixed(2),
        active: svc.active !== false,
      }
    : emptyForm;

export const ServiceFormSheet = ({ open, onOpenChange, service }) => {
  const isEdit = !!service;
  const [form, setForm] = useState(emptyForm);
  const create = useCreateService();
  const update = useUpdateService();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (open) setForm(toForm(service));
  }, [open, service]);

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return toast.error("Service name is required");
    const priceNum = Number(form.price_dollars);
    if (!(priceNum >= 0) || Number.isNaN(priceNum)) return toast.error("Enter a valid price");

    const payload = {
      name,
      description: form.description.trim(),
      category: form.category || null,
      duration_minutes: Number(form.duration_minutes),
      price_cents: Math.round(priceNum * 100),
      currency: "USD",
      active: form.active,
    };

    try {
      if (isEdit) {
        await update.mutateAsync({ id: service.id, patch: payload });
        toast.success("Service updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Service added");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] rounded-t-3xl p-0 flex flex-col"
        data-testid="service-form-sheet"
      >
        <SheetHeader className="px-6 pt-6 pb-2 text-left">
          <SheetTitle className="text-2xl font-bold tracking-tight">
            {isEdit ? "Edit service" : "New service"}
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            {isEdit ? "Update the details clients will see." : "Add a service to your catalog."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 pb-8 pt-4 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="svc-name">Service name</Label>
            <Input
              id="svc-name"
              value={form.name}
              onChange={setField("name")}
              placeholder="e.g. Diabetic Foot Assessment"
              className="h-12 rounded-xl"
              data-testid="service-name-input"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="svc-desc">Description</Label>
            <Textarea
              id="svc-desc"
              value={form.description}
              onChange={setField("description")}
              placeholder="What clients get during this visit."
              rows={4}
              className="rounded-xl resize-none"
              data-testid="service-description-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="svc-category">Category</Label>
            <Select
              value={form.category || undefined}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
            >
              <SelectTrigger id="svc-category" className="h-12 rounded-xl" data-testid="service-category-select">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value} data-testid={`service-category-option-${c.value}`}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex flex-wrap gap-2" data-testid="service-duration-presets">
              {DURATION_PRESETS.map((m) => {
                const selected = Number(form.duration_minutes) === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, duration_minutes: m }))}
                    className={`h-11 min-w-[68px] px-4 rounded-full text-sm font-semibold transition-colors duration-200 border ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent text-foreground border-border hover:border-primary/40"
                    }`}
                    data-testid={`service-duration-${m}`}
                  >
                    {m < 60 ? `${m}m` : `${m / 60}h${m % 60 ? ` ${m % 60}m` : ""}`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="svc-price">Price (USD)</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                $
              </span>
              <Input
                id="svc-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.price_dollars}
                onChange={setField("price_dollars")}
                placeholder="85.00"
                className="h-12 rounded-xl pl-8"
                data-testid="service-price-input"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-black/5 bg-card p-4">
            <div>
              <p className="font-semibold text-foreground">Active</p>
              <p className="text-sm text-muted-foreground">Inactive services are hidden from clients.</p>
            </div>
            <Switch
              checked={form.active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              data-testid="service-active-switch"
            />
          </div>
        </form>

        <div className="border-t border-black/5 bg-white/80 backdrop-blur-md px-6 py-4 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-12 rounded-full flex-1 active:scale-95 transition-transform duration-200"
            data-testid="service-form-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="h-12 rounded-full flex-1 font-semibold active:scale-95 transition-transform duration-200"
            data-testid="service-form-save"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add service"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
