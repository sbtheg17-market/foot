import React from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { Leaf, Search, LayoutDashboard, ShieldCheck, CalendarDays, LogOut, LogIn } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";

function useLinks(role) {
  const base = [
    { to: "/", label: "Discover", icon: Search, exact: true, role: "any" },
    { to: "/bookings", label: "My Bookings", icon: CalendarDays, role: "any" },
  ];
  const providerLink = { to: "/provider", label: "Provider", icon: LayoutDashboard, role: "provider-or-admin" };
  const adminLink = { to: "/admin", label: "Admin", icon: ShieldCheck, role: "admin" };
  if (role === "admin") return [...base, providerLink, adminLink];
  if (role === "provider") return [...base, providerLink];
  return base;
}

export default function Shell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { status, user, provider, logout } = useAuth();
  const links = useLinks(user?.role);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 glass border-b border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-2 group shrink-0">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Leaf className="h-5 w-5" />
            </span>
            <span className="font-heading text-xl font-semibold tracking-tight">SoleCare</span>
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
                    active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {status === "authed" ? (
              <>
                <div className="hidden sm:flex flex-col items-end leading-tight">
                  <span className="text-sm font-medium">{user.name || user.email}</span>
                  <span className="text-[11px] text-muted-foreground capitalize">
                    {user.role}{provider ? ` · ${provider.name}` : ""}
                  </span>
                </div>
                {user.picture ? (
                  <img src={user.picture} alt="" className="h-9 w-9 rounded-2xl object-cover border border-border" />
                ) : (
                  <div className="h-9 w-9 rounded-2xl bg-secondary text-primary flex items-center justify-center text-sm font-semibold">
                    {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="nav-logout"
                  onClick={async () => { await logout(); navigate("/", { replace: true }); }}
                  className="h-10 rounded-full"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button data-testid="nav-login" className="h-10 rounded-full bg-primary">
                  <LogIn className="h-4 w-4 mr-2" /> Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 pb-32 md:pb-12">{children}</main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-border/60">
        <div className={`grid`} style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
          {links.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                data-testid={`nav-mobile-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn("flex flex-col items-center justify-center gap-1 h-16 text-xs",
                  active ? "text-primary" : "text-muted-foreground")}
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
