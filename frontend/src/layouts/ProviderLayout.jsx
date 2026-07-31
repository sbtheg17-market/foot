import { Outlet } from "react-router-dom";
import { BottomNav } from "../components/BottomNav";

/**
 * Provider shell. Owns the mobile-first container and glass bottom nav.
 * Child routes render inside <Outlet />.
 */
export const ProviderLayout = () => (
  <div className="min-h-screen bg-background pb-20">
    <div className="max-w-md mx-auto md:max-w-2xl">
      <Outlet />
    </div>
    <BottomNav />
  </div>
);
