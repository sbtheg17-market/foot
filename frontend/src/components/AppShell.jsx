import { BottomNav } from "./BottomNav";

export const AppShell = ({ children }) => (
  <div className="min-h-screen bg-background pb-20">
    <div className="max-w-md mx-auto md:max-w-2xl">{children}</div>
    <BottomNav />
  </div>
);
