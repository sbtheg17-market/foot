import React from 'react';
import { Link, useLocation } from 'wouter';
import { useGetMe, useLogout } from '@workspace/api-client-react';
import { LogOut, CalendarDays } from 'lucide-react';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { data: me } = useGetMe({ query: { retry: false, queryKey: ['me'] } });
  const logout = useLogout();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem('oncallfoot_token');
        setLocation('/login');
      }
    });
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col mx-auto max-w-[500px] shadow-2xl bg-white relative">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border/50 h-16 flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-lg shadow-sm">
            O
          </div>
          <span className="font-serif font-semibold text-lg tracking-tight text-foreground">OnCall Foot</span>
        </Link>
        <div className="flex items-center gap-4">
          {me?.user ? (
            <div className="flex items-center gap-3">
              {me.user.role === 'provider' && (
                <Link href="/portal" className="text-sm font-medium text-primary hover:underline">
                  Portal
                </Link>
              )}
              {me.user.role === 'client' && (
                <Link href="/bookings" className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground hover:bg-secondary/80 transition-colors" title="My Bookings">
                  <CalendarDays className="w-4 h-4" />
                </Link>
              )}
              <button onClick={handleLogout} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground hover:bg-secondary/80 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link href="/login" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Log in
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
