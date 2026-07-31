import { NavLink } from "react-router-dom";
import { Home, CalendarCheck, Briefcase, Wallet, User } from "lucide-react";
import { ROUTES } from "../lib/routes";

const items = [
  { to: ROUTES.provider.home, label: "Home", icon: Home, testId: "nav-home", end: true },
  { to: ROUTES.provider.bookings, label: "Bookings", icon: CalendarCheck, testId: "nav-bookings" },
  { to: ROUTES.provider.services, label: "Services", icon: Briefcase, testId: "nav-services" },
  { to: ROUTES.provider.earnings, label: "Earnings", icon: Wallet, testId: "nav-earnings" },
  { to: ROUTES.provider.profile, label: "Profile", icon: User, testId: "nav-profile" },
];

export const BottomNav = () => (
  <nav
    data-testid="bottom-nav"
    className="fixed bottom-0 inset-x-0 z-50 h-16 bg-white/80 backdrop-blur-xl border-t border-black/5 flex justify-around items-center md:max-w-md md:mx-auto md:rounded-t-2xl"
  >
    {items.map(({ to, label, icon: Icon, testId, end }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        data-testid={testId}
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-full transition-colors duration-200 ${
            isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`
        }
      >
        <Icon size={22} strokeWidth={2} />
        <span className="text-[10px] font-semibold tracking-wide">{label}</span>
      </NavLink>
    ))}
  </nav>
);
