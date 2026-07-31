import { Link } from "react-router-dom";
import { FileText, ChevronRight } from "lucide-react";
import { useInvoices } from "./hooks";
import { formatMoney } from "../../lib/format";
import { ROUTES } from "../../lib/routes";

export default function InvoicesPage() {
  const { data, isLoading } = useInvoices();

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Records</p>
        <h1 className="text-lg font-bold tracking-tight text-foreground">Invoices</h1>
      </header>

      <main className="px-5 py-6 space-y-3" data-testid="invoices-page">
        {isLoading && (
          <div className="rounded-2xl bg-card border border-black/5 p-4 h-16 animate-pulse" />
        )}
        {!isLoading && (data || []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 flex flex-col items-start gap-3" data-testid="invoices-empty">
            <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-primary">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground mb-1">No invoices yet</h3>
              <p className="text-sm text-muted-foreground">Invoices auto-generate the moment a booking is completed.</p>
            </div>
          </div>
        )}
        {(data || []).map((inv) => (
          <Link
            key={inv.id}
            to={`/provider/invoices/${inv.id}`}
            className="flex items-center gap-3 rounded-2xl bg-card border border-black/5 p-4 hover:shadow-md hover:-translate-y-0.5 transition-shadow duration-200"
            data-testid={`invoice-card-${inv.id}`}
          >
            <div className="h-11 w-11 rounded-xl bg-secondary text-primary flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{inv.invoice_number}</p>
              <p className="text-xs text-muted-foreground truncate">
                {inv.client?.name} · {(inv.issued_at || "").slice(0, 10)}
              </p>
            </div>
            <p className="font-bold text-foreground">{formatMoney(inv.total_cents, inv.currency)}</p>
            <ChevronRight size={16} className="text-muted-foreground" />
          </Link>
        ))}
      </main>
    </>
  );
}
