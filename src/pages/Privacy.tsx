import heroCattle from '@/assets/hero-cattle.jpg';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { EntranceReveal, StaggerContainer, AnimatedItem, PulseBadge } from '@/components/animations/AnimationComponents';
import { ParallaxImage } from '@/components/animations/ParallaxEffect';
import { Link } from 'react-router-dom';

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
    <div className="min-h-screen bg-background overflow-hidden">
      <motion.div
        className="fixed inset-0 -z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="absolute top-20 right-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl"
          animate={{
            y: [0, 40, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Hero Image */}
          <motion.div
            className="glass-card p-4 mb-8 rounded-2xl overflow-hidden"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="relative aspect-[16/7] rounded-xl overflow-hidden">
              <ParallaxImage
                src={heroCattle}
                alt="Cattle and buffalo"
                strength={0.3}
                className="relative aspect-[16/7] rounded-xl overflow-hidden"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
              <motion.div
                className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-card/80 text-xs font-medium text-foreground"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                Data & Privacy
              </motion.div>
            </div>
          </motion.div>

          {/* Title */}
          <EntranceReveal direction="down" duration={0.6} delay={0.3}>
            <h1 className="text-5xl font-display font-bold text-foreground mb-6 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Privacy Policy
            </h1>
          </EntranceReveal>

          {/* Stats and Tags */}
          <motion.div
            className="flex flex-wrap gap-3 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <PulseBadge variant="default">Minimal Data</PulseBadge>
            <PulseBadge variant="default">Secure Storage</PulseBadge>
            <PulseBadge variant="default">User Control</PulseBadge>
            {stats && (
              <>
                <PulseBadge variant="success">{stats.breeds} Breeds</PulseBadge>
                <PulseBadge variant="success">{stats.datasets} Datasets</PulseBadge>
              </>
            )}
          </motion.div>

          {/* Content */}
          <StaggerContainer delay={0.08} className="space-y-6">
            <AnimatedItem variant="fadeInUp" className="text-muted-foreground leading-relaxed text-lg">
              This Privacy Policy explains how BreedAI handles information when you
              use the application. We only collect data necessary to deliver core
              features such as image classification and history.
            </AnimatedItem>
            <AnimatedItem variant="fadeInUp" className="text-muted-foreground leading-relaxed text-lg">
              Images you upload or capture are processed for classification and may
              be retained to improve results and provide history. You can request
              removal by contacting us.
            </AnimatedItem>
            <AnimatedItem variant="fadeInUp" className="text-muted-foreground leading-relaxed text-lg">
              If you have any questions about privacy, reach out to us at{' '}
              <motion.a
                href="mailto:ROHAN.20221CSE0009@PresidencyUniversity.in"
                className="text-primary font-semibold hover:underline"
                whileHover={{ scale: 1.05 }}
              >
                ROHAN.20221CSE0009@PresidencyUniversity.in
              </motion.a>
              .
            </AnimatedItem>
          </StaggerContainer>

          {/* Return Button */}
          <motion.div
            className="mt-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <motion.div
              className="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-purple-600 text-primary-foreground font-semibold relative overflow-hidden group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.span
                className="absolute inset-0 bg-white/20"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.5 }}
              />
              <Link to="/" className="relative z-10">Return to Home</Link>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
