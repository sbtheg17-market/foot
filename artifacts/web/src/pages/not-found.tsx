export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 text-center mx-auto max-w-[500px]">
      <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center text-muted-foreground mb-6">
        <span className="font-serif text-3xl font-bold">404</span>
      </div>
      <h1 className="text-3xl font-serif font-bold text-foreground mb-3">Page not found</h1>
      <p className="text-muted-foreground mb-8">The page you're looking for doesn't exist or has been moved.</p>
      <button 
        onClick={() => window.history.back()} 
        className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
      >
        Go back
      </button>
    </div>
  );
}