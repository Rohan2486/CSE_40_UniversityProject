import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

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
    <div className="min-h-screen bg-background grid place-items-center px-4">
      <div className="w-full max-w-md glass-card p-6">
      <h1 className="text-3xl font-display font-bold text-foreground mb-2">Sign up</h1>
      <p className="text-sm text-muted-foreground mb-6">Create your account to use BreedVision.</p>
      <form onSubmit={handleSignup} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        />
        <button type="submit" className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-60" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Signup'}
        </button>
      </form>
      {error && <p className="text-destructive text-sm mt-3">{error}</p>}
      {notice && <p className="text-success text-sm mt-3">{notice}</p>}
      {!!pendingEmail && (
        <button
          type="button"
          onClick={handleResendConfirmation}
          className="mt-3 w-full rounded-md border border-input px-3 py-2 text-sm text-foreground disabled:opacity-60"
          disabled={isResending}
        >
          {isResending ? 'Resending...' : 'Resend confirmation email'}
        </button>
      )}
      <p className="text-sm text-muted-foreground mt-5">
        Already have an account?{' '}
        <Link to="/login" className="text-primary underline">
          Login
        </Link>
      </p>
      </div>
    </div>
  );
};

export default Signup;
