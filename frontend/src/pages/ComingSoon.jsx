import { Hourglass } from "lucide-react";
import { AppShell } from "../components/AppShell";

export default function ComingSoon({ title, checkpoint }) {
  return (
    <AppShell>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-5 py-4">
        <h1 className="text-lg font-bold tracking-tight text-foreground">{title}</h1>
      </header>
      <main className="px-5 py-16 flex flex-col items-start" data-testid="coming-soon">
        <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center text-primary mb-6">
          <Hourglass size={26} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">{title} is coming soon</h2>
        <p className="text-muted-foreground leading-relaxed">
          This section arrives in Checkpoint {checkpoint}. We're building it next.
        </p>
      </main>
    </AppShell>
  );
}
