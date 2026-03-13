import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../integrations/supabase/client';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import heroCattle from '@/assets/hero-cattle.jpg';
import { InlineLoader } from '@/components/animations/SmoothLoader';
import { EntranceReveal, SuccessCheckmark } from '@/components/animations/AnimationComponents';
import { Card3D } from '@/components/animations/Motion3D';
import { ParallaxImage } from '@/components/animations/ParallaxEffect';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [notice, setNotice] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setNotice('');
    setPendingEmail('');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) {
      setError(error.message);
      toast.error(error.message);
    } else {
      const hasNewIdentity = (data.user?.identities?.length ?? 0) > 0;
      const confirmationMessage = data.session
        ? 'Signup successful. You are now signed in.'
        : hasNewIdentity
          ? 'Signup successful. Please check your inbox for the confirmation email from Supabase.'
          : 'Signup request accepted. If this email already exists, another confirmation email may not be sent.';
      toast.success(confirmationMessage);
      setNotice(confirmationMessage);
      if (!data.session) {
        setPendingEmail(email);
      }
    }

    setIsSubmitting(false);
  };

  const handleResendConfirmation = async () => {
    if (!pendingEmail) return;
    setIsResending(true);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Supabase confirmation email resend requested. Check inbox/spam in 1-2 minutes.');
    }

    setIsResending(false);
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
                  Trusted Dataset
                </p>
                <h2 className="mt-3 text-2xl font-display font-bold text-foreground">
                  Create your account and start tracking live classifications.
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
              Sign up
            </h1>
            <p className="text-muted-foreground">Create your account to use BreedAI</p>
          </motion.div>

          {/* Form */}
          <motion.form
            onSubmit={handleSignup}
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

            {/* Success Message */}
            {notice && (
              <motion.div
                className="bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-sm px-4 py-3 rounded-lg flex gap-3"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SuccessCheckmark className="w-5 h-5 flex-shrink-0" />
                <div>{notice}</div>
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
                    <span>Creating account...</span>
                  </>
                ) : (
                  'Signup'
                )}
              </div>
            </motion.button>

            {/* Resend Email Button */}
            {!!pendingEmail && (
              <motion.button
                type="button"
                onClick={handleResendConfirmation}
                disabled={isResending}
                className="w-full rounded-xl border border-primary/50 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={!isResending ? { scale: 1.02 } : {}}
                whileTap={!isResending ? { scale: 0.98 } : {}}
              >
                {isResending ? 'Resending...' : 'Resend confirmation email'}
              </motion.button>
            )}
          </motion.form>

          {/* Login Link */}
          <motion.div
            className="text-center mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <motion.span className="inline-block">
                <Link
                  to="/login"
                  className="text-primary font-semibold hover:underline"
                >
                  Login
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

export default Signup;
