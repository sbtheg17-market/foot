import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { ROUTES } from '@/lib/routes';

export default function ClientOnboarding() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(ROUTES.client.discover, { replace: true });
  }, [setLocation]);

  return (
    <main className="min-h-[100dvh] bg-background flex items-center justify-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Taking you to your care space…</p>
      </div>
    </main>
  );
}