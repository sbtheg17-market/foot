import { useState } from "react";
import { Plus, Pencil, Trash2, Clock, Briefcase, Tag } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { formatMoney, formatDuration } from "../../lib/format";
import { CATEGORY_LABEL } from "../../lib/serviceCategories";
import { useServices, useToggleService } from "./hooks";
import { ServiceFormSheet } from "./ServiceFormSheet";
import { DeleteServiceDialog } from "./DeleteServiceDialog";

const EmptyState = ({ onAdd }) => (
  <div
    className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 flex flex-col items-start gap-4"
    data-testid="services-empty-state"
  >
    <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-primary">
      <Briefcase size={22} />
    </div>
    <div>
      <h3 className="text-xl font-bold tracking-tight text-foreground mb-1">Build your catalog</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Add the services you offer during home visits. Clients will see these when they book you.
      </p>
    </div>
    <Button
      onClick={onAdd}
      className="h-11 rounded-full px-5 font-semibold active:scale-95 transition-transform duration-200"
      data-testid="services-empty-add-btn"
    >
      <Plus size={18} className="mr-1" /> Add your first service
    </Button>
  </div>
);

const ServiceCard = ({ svc, onEdit, onDelete, onToggle }) => (
  <div
    className={`rounded-2xl border border-black/5 bg-card p-4 flex flex-col gap-3 transition-shadow duration-200 hover:shadow-md ${
      svc.active ? "" : "opacity-70"
    }`}
    data-testid={`service-card-${svc.id}`}
  >
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="text-lg font-bold tracking-tight text-foreground truncate">{svc.name}</h3>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              svc.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
            data-testid={`service-status-${svc.id}`}
          >
            {svc.active ? "Active" : "Inactive"}
          </span>
        </div>
        {svc.description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {svc.description}
          </p>
        )}
      </div>
      <Switch
        checked={!!svc.active}
        onCheckedChange={() => onToggle(svc.id)}
        data-testid={`service-toggle-${svc.id}`}
      />
    </div>

    <div className="flex items-center gap-4 text-sm flex-wrap">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Clock size={14} /> {formatDuration(svc.duration_minutes)}
      </span>
      <span className="font-semibold text-foreground" data-testid={`service-price-${svc.id}`}>
        {formatMoney(svc.price_cents, svc.currency)}
      </span>
      {svc.category && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          data-testid={`service-category-${svc.id}`}
        >
          <Tag size={10} /> {CATEGORY_LABEL[svc.category] || svc.category}
        </span>
      )}
    </div>

    <div className="flex gap-2 pt-1">
      <Button
        variant="outline"
        onClick={() => onEdit(svc)}
        className="h-10 rounded-full px-4 text-sm font-semibold active:scale-95 transition-transform duration-200"
        data-testid={`service-edit-${svc.id}`}
      >
        <Pencil size={14} className="mr-1.5" /> Edit
      </Button>
      <Button
        variant="ghost"
        onClick={() => onDelete(svc)}
        className="h-10 rounded-full px-4 text-sm font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive active:scale-95 transition-transform duration-200"
        data-testid={`service-delete-btn-${svc.id}`}
      >
        <Trash2 size={14} className="mr-1.5" /> Remove
      </Button>
    </div>
  </div>
);

const SkeletonCard = () => (
  <div className="rounded-2xl border border-black/5 bg-card p-4 space-y-3 animate-pulse">
    <div className="h-5 w-2/3 bg-muted rounded-md" />
    <div className="h-3 w-full bg-muted rounded-md" />
    <div className="h-3 w-1/2 bg-muted rounded-md" />
  </div>
);

export default function ServicesPage() {
  const { data: services, isLoading, isError } = useServices();
  const toggle = useToggleService();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const openEdit = (svc) => {
    setEditing(svc);
    setSheetOpen(true);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Catalog
          </p>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Services</h1>
        </div>
        {services?.length > 0 && (
          <Button
            onClick={openAdd}
            className="h-11 rounded-full px-4 font-semibold active:scale-95 transition-transform duration-200"
            data-testid="services-add-btn"
          >
            <Plus size={18} className="mr-1" /> New
          </Button>
        )}
      </header>

      <main className="px-5 py-6 space-y-4" data-testid="services-page">
        {isLoading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {isError && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Couldn't load services. Please refresh.
          </div>
        )}

        {!isLoading && services?.length === 0 && <EmptyState onAdd={openAdd} />}

        {!isLoading && services?.length > 0 && (
          <div className="space-y-3" data-testid="services-list">
            {services.map((svc) => (
              <ServiceCard
                key={svc.id}
                svc={svc}
                onEdit={openEdit}
                onDelete={setDeleting}
                onToggle={(id) => toggle.mutate(id)}
              />
            ))}
          </div>
        )}
      </main>

      <ServiceFormSheet open={sheetOpen} onOpenChange={setSheetOpen} service={editing} />
      <DeleteServiceDialog service={deleting} onOpenChange={setDeleting} />
    </>
  );
}
