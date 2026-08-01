import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Leaf, Search, LayoutDashboard, ShieldCheck, CalendarDays } from "lucide-react";
import { cn } from "../lib/utils";

const links = [
  { to: "/", label: "Discover", icon: Search, exact: true },
  { to: "/bookings", label: "My Bookings", icon: CalendarDays },
  { to: "/provider", label: "Provider", icon: LayoutDashboard },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
];

export default function Shell({ children }) {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 glass border-b border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 group">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Leaf className="h-5 w-5" />
            </span>
            <span className="font-heading text-xl font-semibold tracking-tight">SoleCare</span>
            <span className="hidden sm:inline text-xs text-muted-foreground ml-2">Foot-Care Marketplace OS</span>
          </NavLink>
          <nav className="hidden md:flex items-center gap-1">
            {links.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? location.pathname === to : location.pathname.startsWith(to);
              return (
                <NavLink
                  key={to}
                  to={to}
                  data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 h-11 text-sm font-medium",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 pb-32 md:pb-12">{children}</main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-border/60">
        <div className="grid grid-cols-4">
          {links.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                data-testid={`nav-mobile-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 h-16 text-xs",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
