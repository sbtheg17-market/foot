import React, { useState } from 'react';
import { useListBookings, useUpdateBookingStatus, ListBookingsStatus } from '@workspace/api-client-react';
import { Calendar, MapPin, Clock, FileText, ChevronRight, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function PortalBookings() {
  const [activeTab, setActiveTab] = useState<ListBookingsStatus>('requested');
  
  const { data, isLoading, refetch } = useListBookings(
    { status: activeTab },
    { query: { queryKey: ['bookings', activeTab] } }
  );

  const updateStatus = useUpdateBookingStatus();
  // Per-booking in-flight guard: only one action per booking at a time.
  const [pendingId, setPendingId] = useState<number | null>(null);

  const handleStatusChange = (
    id: number,
    newStatus: ListBookingsStatus,
    cancellationReason?: string,
  ) => {
    if (pendingId !== null) return; // another request is already in flight
    setPendingId(id);
    updateStatus.mutate(
      {
        bookingId: id,
        data: {
          status: newStatus,
          ...(cancellationReason ? { cancellationReason } : {}),
        },
      },
      {
        onSuccess: () => {
          const labels: Partial<Record<ListBookingsStatus, string>> = {
            confirmed: 'Booking accepted ✓',
            cancelled: 'Booking declined',
            completed: 'Marked as completed ✓',
          };
          toast.success(labels[newStatus] ?? `Booking marked as ${newStatus.replace('_', ' ')}`);
          refetch();
          setPendingId(null);
        },
        onError: (err) => {
          // 409 means the booking status changed before we could act on it.
          // Silently refetch so the UI shows the real current state.
          if ((err as { status?: number }).status === 409) {
            toast.info('This booking was already updated — refreshing.');
            refetch();
          } else {
            toast.error('Could not update booking. Please try again.');
          }
          setPendingId(null);
        },
      }
    );
  };

  const tabs: { id: ListBookingsStatus; label: string }[] = [
    { id: 'requested', label: 'Requests' },
    { id: 'confirmed', label: 'Upcoming' },
    { id: 'completed', label: 'Past' },
  ];

  return (
    <div className="p-6 pt-10 pb-32 max-w-4xl mx-auto h-full flex flex-col">
      <h1 className="text-3xl font-serif font-bold text-foreground mb-6">Bookings</h1>

      <div className="flex bg-secondary p-1 rounded-xl mb-6 shadow-inner overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl h-32 animate-pulse" />
          ))
        ) : data?.bookings.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4 text-muted-foreground">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="font-serif font-medium text-lg mb-1 text-foreground">No bookings found</h3>
            <p className="text-muted-foreground">There are no {activeTab} bookings.</p>
          </div>
        ) : (
          data?.bookings.map(booking => (
            <div key={booking.id} className="bg-card border border-border rounded-3xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2 text-primary font-medium text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    {new Date(booking.scheduledAt).toLocaleString('en-US', { 
                      weekday: 'short', month: 'short', day: 'numeric', 
                      hour: 'numeric', minute: '2-digit' 
                    })}
                  </div>
                  <h3 className="font-serif font-bold text-lg text-foreground">Client ID: {booking.clientId}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {booking.address}, {booking.city}
                  </p>
                </div>
              </div>

              {booking.clientNotes && (
                <div className="bg-secondary/50 rounded-xl p-3 mb-4 flex items-start gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/80 italic">"{booking.clientNotes}"</p>
                </div>
              )}

              {/* Actions based on status */}
              {activeTab === 'requested' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleStatusChange(booking.id, 'confirmed')}
                    disabled={pendingId === booking.id}
                    className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pendingId === booking.id
                      ? <span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      : <><Check className="w-5 h-5" /> Accept</>
                    }
                  </button>
                  <button
                    onClick={() => handleStatusChange(booking.id, 'cancelled', 'Request declined by provider')}
                    disabled={pendingId === booking.id}
                    className="w-12 h-12 bg-secondary text-secondary-foreground rounded-xl flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pendingId === booking.id
                      ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : <X className="w-5 h-5" />
                    }
                  </button>
                </div>
              )}

              {activeTab === 'confirmed' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleStatusChange(booking.id, 'completed')}
                    disabled={pendingId === booking.id}
                    className="flex-1 py-3 border-2 border-primary text-primary bg-primary/5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pendingId === booking.id
                      ? <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : 'Mark Completed'
                    }
                  </button>
                </div>
              )}

              {activeTab === 'completed' && (
                <div className="w-full text-center py-2 text-sm font-medium text-muted-foreground bg-secondary/30 rounded-xl">
                  Completed
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
