import React from 'react';
import { Link } from 'wouter';
import { useGetMyEarningsExport } from '@workspace/api-client-react';
import { ArrowLeft, Printer } from 'lucide-react';
import { ROUTES } from '@/lib/routes';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function PortalEarningsStatement() {
  const { data, isLoading } = useGetMyEarningsExport({
    query: { queryKey: ['my-earnings-export'] }
  });

  if (isLoading) {
    return <div className="p-6 pt-20 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  }

  const providerName = `${data?.provider.firstName ?? ''} ${data?.provider.lastName ?? ''}`.trim();
  const generated = data?.generatedAt ? new Date(data.generatedAt) : new Date();

  return (
    <div className="p-6 pt-10 pb-32 max-w-4xl mx-auto print:p-0 print:pb-0 print:max-w-none">
      {/* Screen-only toolbar */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <Link
          href={ROUTES.provider.earnings}
          data-testid="statement-back-link"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Earnings
        </Link>
        <button
          onClick={() => window.print()}
          data-testid="statement-print-btn"
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold shadow-sm flex items-center gap-2 hover:bg-primary/90 transition-colors active:scale-[0.98]"
        >
          <Printer className="w-4 h-4" /> Print / Save PDF
        </button>
      </div>

      {/* Printable statement */}
      <div
        data-testid="earnings-statement"
        className="bg-card border border-border rounded-3xl p-8 shadow-sm print:border-0 print:shadow-none print:rounded-none print:p-0"
      >
        <div className="flex justify-between items-start pb-6 border-b-2 border-foreground/80">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">Earnings Statement</h1>
            <p className="text-sm text-muted-foreground mt-1">OnCall Foot — provider earnings summary</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-serif font-bold text-foreground text-base" data-testid="statement-provider-name">{providerName}</p>
            {data?.provider.title && <p className="text-muted-foreground">{data.provider.title}</p>}
            {data?.provider.city && <p className="text-muted-foreground">{data.provider.city}</p>}
          </div>
        </div>

        <div className="flex justify-between text-sm py-4 border-b border-border">
          <span className="text-muted-foreground">
            Generated {generated.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="text-muted-foreground">{data?.count ?? 0} completed booking{(data?.count ?? 0) === 1 ? '' : 's'}</span>
        </div>

        {data?.items.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No completed bookings yet — complete a booking to see it here.</p>
        ) : (
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-3 pr-3 font-medium">Date</th>
                <th className="py-3 pr-3 font-medium">Client</th>
                <th className="py-3 pr-3 font-medium">Service</th>
                <th className="py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map(item => (
                <tr key={item.bookingId} className="border-b border-border/60" data-testid={`statement-row-${item.bookingId}`}>
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {new Date(item.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-3 pr-3">{item.clientFirstName} {item.clientLastName}</td>
                  <td className="py-3 pr-3">{item.serviceTitle}</td>
                  <td className="py-3 text-right font-medium">{money(item.amountCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-4 text-right font-serif font-bold text-base">Total earned</td>
                <td className="py-4 text-right font-serif font-bold text-base" data-testid="statement-total">
                  {money(data?.totalCents ?? 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        <p className="mt-8 pt-4 border-t border-border text-xs text-muted-foreground">
          This statement summarizes completed bookings only. It is not a tax document.
        </p>
      </div>
    </div>
  );
}
