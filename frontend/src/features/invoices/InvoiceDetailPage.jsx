import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { formatMoney } from "../../lib/format";
import { useInvoice } from "./hooks";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: inv, isLoading } = useInvoice(id);

  const download = () => {
    window.open(`${process.env.REACT_APP_BACKEND_URL}/api/invoices/${id}/pdf`, "_blank");
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-5 py-4 flex items-center gap-3 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
          data-testid="invoice-back-btn"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-foreground flex-1">Invoice</h1>
        {inv && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="h-10 rounded-full px-3 active:scale-95 transition-transform duration-200"
              data-testid="invoice-print-btn"
            >
              <Printer size={16} className="mr-1.5" /> Print
            </Button>
            <Button
              onClick={download}
              className="h-10 rounded-full px-3 font-semibold active:scale-95 transition-transform duration-200"
              data-testid="invoice-download-btn"
            >
              <Download size={16} className="mr-1.5" /> PDF
            </Button>
          </div>
        )}
      </header>

      <main className="px-5 py-6 print:p-8" data-testid="invoice-detail">
        {isLoading && <div className="rounded-2xl bg-card border border-black/5 h-64 animate-pulse" />}
        {inv && (
          <article className="bg-white rounded-2xl border border-black/5 p-6 space-y-6 print:shadow-none print:border-0" data-testid="invoice-body">
            <header className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">OnCall Foot</p>
                <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1" data-testid="invoice-number">
                  {inv.invoice_number}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Issued {(inv.issued_at || "").slice(0, 10)} · {inv.status?.toUpperCase()}
                </p>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">From</p>
                <p className="font-bold text-foreground">{inv.provider_name || "Provider"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">Billed to</p>
                <p className="font-bold text-foreground">{inv.client?.name}</p>
                {inv.client?.phone && <p className="text-sm text-muted-foreground">{inv.client.phone}</p>}
                {inv.client?.address && (
                  <p className="text-sm text-muted-foreground">
                    {inv.client.address}
                    {inv.client.pincode ? ` · ${inv.client.pincode}` : ""}
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="h-0.5 bg-primary/30 rounded-full mb-3" />
              <div className="grid grid-cols-[1fr_60px_100px_100px] gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit</span>
                <span className="text-right">Total</span>
              </div>
              <div className="border-t border-border mt-2">
                {(inv.line_items || []).map((li, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_60px_100px_100px] gap-2 py-3 border-b border-border text-sm"
                    data-testid={`invoice-line-${i}`}
                  >
                    <span className="text-foreground">{li.description}</span>
                    <span className="text-right text-muted-foreground">{li.quantity}</span>
                    <span className="text-right text-foreground">{formatMoney(li.unit_price_cents, inv.currency)}</span>
                    <span className="text-right font-semibold text-foreground">{formatMoney(li.total_cents, inv.currency)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <div className="w-56 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatMoney(inv.subtotal_cents, inv.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="text-foreground">{formatMoney(inv.tax_cents, inv.currency)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="text-sm font-bold text-primary tracking-wider">TOTAL</span>
                  <span className="text-lg font-bold text-primary" data-testid="invoice-total">
                    {formatMoney(inv.total_cents, inv.currency)}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-4 border-t border-border">
              Thank you. Generated by OnCall Foot.
            </p>
          </article>
        )}
      </main>
    </>
  );
}
