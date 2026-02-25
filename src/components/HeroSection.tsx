import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, Brain, Zap, Target } from 'lucide-react';
import { Button } from './ui/button';
import heroCattle from '@/assets/hero-cattle.jpg';
import heroCattleWebp from '@/assets/hero-cattle.webp';

interface HeroSectionProps {
  onGetStarted: () => void;
}

export const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  const [stats, setStats] = useState<{
    breeds: number;
    datasets: number;
    records: number;
    classifications: number;
  } | null>(null);

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
    <section className="relative overflow-hidden py-16 lg:py-24">
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 opacity-10">
          <picture>
            <source srcSet={heroCattleWebp} type="image/webp" />
            <img src={heroCattle} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </picture>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent font-medium text-sm mb-8"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Classification System</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight mb-6"
          >
            Intelligent{' '}
            <span className="text-gradient">Cattle & Buffalo</span>{' '}
            Breed Classification
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Leverage advanced AI models to automatically classify bovine breeds, 
            measure body traits, and generate standardized scores.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Button 
              variant="hero" 
              size="xl" 
              onClick={onGetStarted}
              className="group button-glow"
            >
              Start Classification
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="outline" size="xl" className="button-glow">
              View Documentation
            </Button>
          </motion.div>

          {/* Visual + Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16 items-center"
          >
            <div className="glass-card p-4 overflow-hidden">
              <div className="relative aspect-[16/9] rounded-xl overflow-hidden">
                <picture>
                  <source srcSet={heroCattleWebp} type="image/webp" />
                  <img
                    src={heroCattle}
                    alt="Cattle and buffalo"
                    className="w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-card/80 text-xs font-medium text-foreground">
                  Field-ready AI vision
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Breeds', value: stats ? `${stats.breeds}` : '-' },
                { label: 'Datasets', value: stats ? `${stats.datasets}` : '-' },
                { label: 'Classifications', value: stats ? `${stats.classifications}` : '-' },
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + idx * 0.05 }}
                  className="glass-card p-4 text-center"
                >
                  <div className="text-2xl font-display font-bold text-foreground">
                    {stat.value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Feature Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <FeatureCard
              icon={<Brain className="w-6 h-6" />}
              title="AI-Powered"
              description="Advanced vision models for accurate breed detection"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Real-Time"
              description="Live camera detection with instant results"
            />
            <FeatureCard
              icon={<Target className="w-6 h-6" />}
              title="Precise Scoring"
              description="Standardized classification for RGM compliance"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => (
  <motion.div
    whileHover={{ y: -4 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    className="glass-card p-6 text-center transition-transform duration-300"
  >
    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
      {icon}
    </div>
    <h3 className="font-display font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </motion.div>
);

