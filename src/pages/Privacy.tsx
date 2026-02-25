import heroCattle from '@/assets/hero-cattle.jpg';
import heroCattleWebp from '@/assets/hero-cattle.webp';
import { useEffect, useState } from 'react';

const Privacy = () => {
  const [stats, setStats] = useState<{ breeds: number; datasets: number } | null>(null);

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
          breeds: Number(data.breeds ?? 0),
          datasets: Number(data.datasets ?? 0),
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
              Data & Privacy
            </div>
          </div>
        </div>

        <h1 className="text-4xl font-display font-bold text-foreground mb-6">
          Privacy Policy
        </h1>
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
            Minimal Data
          </span>
          <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
            Secure Storage
          </span>
          <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
            User Control
          </span>
          {stats && (
            <>
              <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                {stats.breeds} Breeds
              </span>
              <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                {stats.datasets} Datasets
              </span>
            </>
          )}
        </div>
        <p className="text-muted-foreground mb-4">
          This Privacy Policy explains how BreedAI handles information when you
          use the application. We only collect data necessary to deliver core
          features such as image classification and history.
        </p>
        <p className="text-muted-foreground mb-4">
          Images you upload or capture are processed for classification and may
          be retained to improve results and provide history. You can request
          removal by contacting us.
        </p>
        <p className="text-muted-foreground mb-8">
          If you have any questions about privacy, reach out to us at{' '}
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

export default Privacy;
