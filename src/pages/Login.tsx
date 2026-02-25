import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
    <div className="min-h-screen bg-background grid place-items-center px-4">
      <div className="w-full max-w-md glass-card p-6">
      <h1 className="text-3xl font-display font-bold text-foreground mb-2">Login</h1>
      <p className="text-sm text-muted-foreground mb-6">Sign in to continue to BreedVision.</p>
      <form onSubmit={handleLogin} className="space-y-3">
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
          {isSubmitting ? 'Signing in...' : 'Login'}
        </button>
      </form>
      {error && <p className="text-destructive text-sm mt-3">{error}</p>}
      <p className="text-sm text-muted-foreground mt-5">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="text-primary underline">
          Create one
        </Link>
      </p>
      </div>
    </div>
  );
};

export default Login;
