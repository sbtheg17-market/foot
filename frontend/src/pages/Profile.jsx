import { useNavigate } from "react-router-dom";
import { Award, LogOut, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { ReseedButton } from "../features/dev/ReseedButton";
import { ROUTES } from "../lib/routes";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate(ROUTES.auth.login);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-5 py-4">
        <h1 className="text-lg font-bold tracking-tight text-foreground">Profile</h1>
      </header>

      <main className="px-5 py-6 space-y-6">
        <section className="rounded-2xl bg-card border border-black/5 p-6" data-testid="profile-card">
          <div className="flex items-center gap-4 mb-5">
            {user?.photo ? (
              <img src={user.photo} alt={user.name} className="h-16 w-16 rounded-full object-cover" data-testid="profile-avatar" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xl font-bold" data-testid="profile-avatar">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-foreground truncate" data-testid="profile-name">{user?.name}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate" data-testid="profile-email">
                <Mail size={14} /> {user?.email}
              </p>
            </div>
          </div>

          {user?.bio ? (
            <p className="text-sm text-muted-foreground leading-relaxed" data-testid="profile-bio">{user.bio}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic" data-testid="profile-bio">No bio yet.</p>
          )}
        </section>

        <section className="rounded-2xl bg-card border border-black/5 p-6" data-testid="profile-certifications">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
            <Award size={14} /> Certifications
          </h3>
          {user?.certifications?.length ? (
            <div className="flex flex-wrap gap-2">
              {user.certifications.map((c, i) => (
                <span key={i} className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No certifications added.</p>
          )}
        </section>

        <Button
          variant="outline"
          onClick={onLogout}
          className="w-full h-12 rounded-full font-semibold text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive active:scale-95 transition-transform duration-200"
          data-testid="logout-btn"
        >
          <LogOut size={18} className="mr-2" /> Sign out
        </Button>

        <section className="rounded-2xl bg-card border border-black/5 p-6 space-y-3" data-testid="profile-demo-tools">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Demo tools
            </h3>
            <p className="text-sm text-muted-foreground">
              Reset the inbox to a fresh, believable state for a live pitch.
            </p>
          </div>
          <ReseedButton />
        </section>
      </main>
    </>
  );
}
