import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import heroCattle from '@/assets/hero-cattle.jpg';
import { InlineLoader } from '@/components/animations/SmoothLoader';
import { EntranceReveal } from '@/components/animations/AnimationComponents';
import { Card3D } from '@/components/animations/Motion3D';
import { ParallaxImage } from '@/components/animations/ParallaxEffect';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      toast.error(error.message);
    } else {
      toast.success('Login successful');
      navigate('/');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4 overflow-hidden py-10">
      <motion.div
        className="fixed inset-0 -z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="absolute top-10 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"
          animate={{
            y: [0, 30, 0],
            x: [0, 20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-10 left-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"
          animate={{
            y: [0, -30, 0],
            x: [0, -20, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
        />
      </motion.div>

      <EntranceReveal direction="up" duration={0.8} className="w-full max-w-5xl">
        <div className="grid gap-6 md:grid-cols-[1.15fr,1fr] items-stretch">
          <Card3D className="glass-card overflow-hidden hidden md:block" strength={8}>
            <div className="relative h-full min-h-[560px]">
              <ParallaxImage
                src={heroCattle}
                alt="Cattle farm scene"
                strength={0.35}
                className="absolute inset-0 h-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8">
                <p className="inline-flex rounded-full bg-card/80 px-3 py-1 text-xs font-semibold text-foreground">
                  Smart Vision Pipeline
                </p>
                <h2 className="mt-3 text-2xl font-display font-bold text-foreground">
                  Classify breeds in seconds with real-time AI confidence.
                </h2>
              </div>
            </div>
          </Card3D>

          <Card3D className="w-full" strength={7}>
        <motion.div
          className="glass-card p-8 rounded-2xl shadow-xl"
          variants={{
            hidden: { opacity: 0, y: 30 },
            visible: { opacity: 1, y: 0 },
          }}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h1 className="text-4xl font-display font-bold text-foreground mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Login
            </h1>
            <p className="text-muted-foreground">Sign in to continue to BreedAI</p>
          </motion.div>

          {/* Form */}
          <motion.form
            onSubmit={handleLogin}
            className="space-y-4 mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            {/* Email Input */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.02 }}
            >
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                required
              />
            </motion.div>

            {/* Password Input */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              whileHover={{ scale: 1.02 }}
            >
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                required
              />
            </motion.div>

            {/* Error Message */}
            {error && (
              <motion.div
                className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {error}
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-purple-600 text-primary-foreground py-3 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden group"
              whileHover={!isSubmitting ? { scale: 1.02 } : {}}
              whileTap={!isSubmitting ? { scale: 0.98 } : {}}
              transition={{ delay: 0.4 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <motion.span
                className="absolute inset-0 bg-white/20"
                initial={{ x: '-100%' }}
                whileHover={!isSubmitting ? { x: '100%' } : {}}
                transition={{ duration: 0.5 }}
              />
              <div className="flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <>
                    <InlineLoader className="border-primary-foreground/40 border-t-primary-foreground" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  'Login'
                )}
              </div>
            </motion.button>
          </motion.form>

          {/* Signup Link */}
          <motion.div
            className="text-center mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <motion.span className="inline-block">
                <Link
                  to="/signup"
                  className="text-primary font-semibold hover:underline"
                >
                  Create one
                </Link>
              </motion.span>
            </p>
          </motion.div>
        </motion.div>
          </Card3D>
        </div>
      </EntranceReveal>
    </div>
  );
};

export default Login;
