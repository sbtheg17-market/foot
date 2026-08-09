import React, { useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { LayoutDashboard, CalendarDays, ClipboardList, Wallet, User as UserIcon, ShieldCheck, Bell } from 'lucide-react';
import { useGetMe, useListBookings, ListBookingsStatus } from '@workspace/api-client-react';
import { useProviderNotifications } from '@/hooks/use-provider-notifications';
import { useUnreadCount } from '@/hooks/use-notification-center';
import { ROUTES } from '@/lib/routes';

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: me, isLoading, error } = useGetMe();

  // Opens SSE stream and shows toast when a new booking arrives
  useProviderNotifications();

  // Badge: count of pending booking requests waiting on provider action
  const { data: pendingData } = useListBookings(
    { status: ListBookingsStatus.requested },
    { query: { queryKey: ['bookings', 'requested', 'badge'], refetchInterval: 30_000 } }
  );
  const pendingCount = pendingData?.total ?? 0;

  // In-app notification unread count (existing owner-scoped API)
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.unreadCount ?? 0;

  useEffect(() => {
    if (!isLoading && (error || !me)) {
      setLocation(ROUTES.login);
    }
  }, [me, isLoading, error, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const tabs = [
    { name: 'Dashboard', path: ROUTES.provider.dashboard, icon: LayoutDashboard, badge: 0 },
    { name: 'Bookings', path: ROUTES.provider.bookings, icon: CalendarDays, badge: pendingCount },
    { name: 'Alerts', path: ROUTES.provider.notifications, icon: Bell, badge: unreadCount },
    { name: 'Services', path: ROUTES.provider.services, icon: ClipboardList, badge: 0 },
    { name: 'Credentials', path: ROUTES.provider.credentials, icon: ShieldCheck, badge: 0 },
    { name: 'Profile', path: ROUTES.provider.profile, icon: UserIcon, badge: 0 },
  ];

  return (
    <div className="min-h-[100dvh] bg-background pb-20 md:pb-0 md:pl-20 relative mx-auto max-w-[500px] md:max-w-none shadow-2xl md:shadow-none bg-white print:pb-0 print:pl-0 print:shadow-none print:max-w-none">
      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t border-border flex items-center justify-around px-2 z-50 md:hidden max-w-[500px] mx-auto shadow-[0_-4px_20px_rgba(0,0,0,0.05)] print:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location === tab.path || (tab.path !== ROUTES.provider.root && location.startsWith(tab.path));
          return (
            <Link key={tab.path} href={tab.path} className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <div className="relative">
                <Icon className={`w-6 h-6 ${isActive ? 'fill-primary/20 stroke-primary' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                {tab.badge > 0 && (
                  <span role="status" aria-label={`${tab.name}: ${tab.badge > 99 ? '99+' : tab.badge}`} className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Desktop Sidebar (hidden on mobile, visible on md) */}
      <div className="hidden md:flex fixed top-0 left-0 bottom-0 w-20 bg-card border-r border-border flex-col items-center py-6 gap-8 z-50 print:hidden">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-xl shadow-sm">
          O
        </div>
        <div className="flex flex-col gap-4 w-full px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location === tab.path || (tab.path !== ROUTES.provider.root && location.startsWith(tab.path));
            return (
              <Link key={tab.path} href={tab.path} className={`relative flex flex-col items-center justify-center w-full aspect-square rounded-2xl gap-1 transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                <div className="relative">
                  <Icon className={`w-6 h-6 ${isActive ? 'fill-primary/20 stroke-primary' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                  {tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <main className="min-h-full">
        {children}
      </main>
    </div>
  );
}
