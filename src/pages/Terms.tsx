import heroCattle from '@/assets/hero-cattle.jpg';
import heroCattleWebp from '@/assets/hero-cattle.webp';
import { useEffect, useState } from 'react';

const Terms = () => {
  const [stats, setStats] = useState<{ records: number; classifications: number } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-stats`,
          {
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          }
        );
        if (!response.ok) return;
        const data = await response.json();
        setStats({
          records: Number(data.records ?? 0),
          classifications: Number(data.classifications ?? 0),
        });
      } catch {
        // ignore stats failures
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
        <div className="glass-card p-4 mb-8">
          <div className="relative aspect-[16/7] rounded-xl overflow-hidden">
            <picture>
              <source srcSet={heroCattleWebp} type="image/webp" />
              <img
                src={heroCattle}
                alt="Cattle and buffalo"
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-card/80 text-xs font-medium text-foreground">
              Usage Terms
            </div>
          </div>
        </div>

        <h1 className="text-4xl font-display font-bold text-foreground mb-6">
          Terms of Service
        </h1>
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
            Fair Use
          </span>
          <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
            Lawful Content
          </span>
          <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
            Service Updates
          </span>
          {stats && (
            <>
              <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                {stats.records} Records
              </span>
              <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                {stats.classifications} Classifications
              </span>
            </>
          )}
        </div>
        <p className="text-muted-foreground mb-4">
          By using BreedAI, you agree to use the service for lawful purposes and
          to provide images you have the right to share. The service is provided
          on an as-is basis without warranties.
        </p>
        <p className="text-muted-foreground mb-4">
          We may update these terms to improve the service. Continued use means
          you accept the updated terms.
        </p>
        <p className="text-muted-foreground mb-8">
          Questions about these terms can be sent to{' '}
          <a
            href="mailto:ROHAN.20221CSE0009@PresidencyUniversity.in"
            className="text-primary underline"
          >
            ROHAN.20221CSE0009@PresidencyUniversity.in
          </a>
          .
        </p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </main>
  </div>
  );
};

export default Terms;
