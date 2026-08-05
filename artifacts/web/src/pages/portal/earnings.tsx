import React from 'react';
import { Link } from 'wouter';
import { useGetMyEarnings, useListInvoices } from '@workspace/api-client-react';
import { DollarSign, CheckCircle2, TrendingUp, ArrowUpRight, FileDown } from 'lucide-react';
import { ROUTES } from '@/lib/routes';

export default function PortalEarnings() {
  const { data: earnings, isLoading: loadingEarnings } = useGetMyEarnings({
    query: { queryKey: ['my-earnings'] }
  });

  const { data: invoicesRes, isLoading: loadingInvoices } = useListInvoices(
    {}, 
    { query: { queryKey: ['my-invoices'] } }
  );

  if (loadingEarnings || loadingInvoices) {
    return <div className="p-6 pt-20 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="p-6 pt-10 pb-32 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-serif font-bold text-foreground">Earnings</h1>

      <Link
        href={ROUTES.provider.earningsStatement}
        data-testid="export-statement-btn"
        className="w-full bg-card border border-border text-foreground px-5 py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-sm hover:border-primary/40 hover:text-primary transition-colors active:scale-[0.98]"
      >
        <FileDown className="w-4 h-4" />
        Export earnings statement
      </Link>

      <div className="bg-primary text-primary-foreground rounded-[2rem] p-8 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 text-primary-foreground/80 font-medium">
            <DollarSign className="w-5 h-5" />
            <span>Lifetime Earnings</span>
          </div>
          <h2 className="text-5xl font-serif font-bold mb-8">
            ${((earnings?.totalCents || 0) / 100).toFixed(2)}
          </h2>
          
          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/20">
            <div>
              <p className="text-primary-foreground/70 text-sm mb-1 font-medium">Pending Payout</p>
              <p className="text-xl font-bold">${((earnings?.pendingPayoutCents || 0) / 100).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-primary-foreground/70 text-sm mb-1 font-medium">Completed Jobs</p>
              <p className="text-xl font-bold">{earnings?.completedBookings || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif font-semibold">Recent Invoices</h2>
          <span className="text-sm font-medium text-muted-foreground bg-secondary px-3 py-1 rounded-full">
            Last 30 days
          </span>
        </div>

        {invoicesRes?.invoices.length === 0 ? (
           <div className="text-center py-12 bg-card rounded-3xl border border-dashed border-border shadow-sm">
             <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
               <TrendingUp className="w-8 h-8" />
             </div>
             <p className="text-foreground font-medium text-lg">No earnings yet</p>
             <p className="text-muted-foreground text-sm mt-1">Complete your first booking to get paid.</p>
           </div>
        ) : (
          <div className="space-y-3">
            {invoicesRes?.invoices.map(invoice => (
              <div key={invoice.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    invoice.status === 'paid' ? 'bg-primary/10 text-primary' : 
                    invoice.status === 'pending' ? 'bg-accent/10 text-accent' : 
                    'bg-secondary text-muted-foreground'
                  }`}>
                    {invoice.status === 'paid' ? <CheckCircle2 className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Booking #{invoice.bookingId}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {new Date(invoice.createdAt || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-serif font-bold text-lg text-foreground">
                    ${(invoice.amountCents / 100).toFixed(2)}
                  </p>
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    invoice.status === 'paid' ? 'text-primary' : 
                    invoice.status === 'pending' ? 'text-accent' : 
                    'text-muted-foreground'
                  }`}>
                    {invoice.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
