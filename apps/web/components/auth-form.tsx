'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { browserClient, isConfigured } from '@/lib/supabase-browser';

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'reset';
const titles: Record<Mode, string> = {
  'sign-in': 'Welcome back',
  'sign-up': 'Create your account',
  forgot: 'Reset your password',
  reset: 'Choose a new password',
};
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    if (!isConfigured()) {
      setError(
        'Supabase is not configured yet. Copy .env.example to .env.local and add your project values.',
      );
      setLoading(false);
      return;
    }
    const fd = new FormData(event.currentTarget);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');
    const supabase = browserClient();
    try {
      if (mode === 'sign-in') {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
        router.replace(params.get('next') || '/dashboard/overview');
        router.refresh();
      }
      if (mode === 'sign-up') {
        const { error: e } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback`,
            data: { display_name: String(fd.get('name') ?? '') },
          },
        });
        if (e) throw e;
        setMessage('Check your email to verify your account, then sign in.');
      }
      if (mode === 'forgot') {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/reset-password`,
        });
        if (e) throw e;
        setMessage('If that account exists, a reset link has been sent.');
      }
      if (mode === 'reset') {
        if (password.length < 10) throw new Error('Use at least 10 characters.');
        const { error: e } = await supabase.auth.updateUser({ password });
        if (e) throw e;
        setMessage('Password updated. You can now return to the dashboard.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-card card">
        <div className="brand">
          <span className="brand-mark">R</span>Rudder Social Agent
        </div>
        <h1 style={{ marginTop: 28 }}>{titles[mode]}</h1>
        <p className="muted">
          {mode === 'sign-in'
            ? 'Steer your publishing from one calm workspace.'
            : 'Secure access powered by Supabase Auth.'}
        </p>
        <form className="form-stack" onSubmit={submit}>
          {mode === 'sign-up' && (
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" required minLength={2} />
            </div>
          )}
          {mode !== 'reset' && (
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
          )}
          {mode !== 'forgot' && (
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={10}
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                required
              />
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="success" role="status">
              {message}
            </div>
          )}
          <button className="btn" disabled={loading}>
            {loading ? 'Please wait…' : titles[mode]}
          </button>
        </form>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, fontSize: 14 }}
        >
          {mode === 'sign-in' ? (
            <>
              <Link href="/sign-up">Create account</Link>
              <Link href="/forgot-password">Forgot password?</Link>
            </>
          ) : (
            <Link href="/sign-in">Back to sign in</Link>
          )}
        </div>
      </section>
    </main>
  );
}
