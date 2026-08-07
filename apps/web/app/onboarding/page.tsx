'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient, isConfigured } from '@/lib/supabase-browser';
const steps = [
  ['Welcome', 'Rudder coordinates official Page publishing and confirmation-first Group posting.'],
  ['Connection check', 'Confirm this installation can reach your Supabase project.'],
  ['Workspace', 'Create the organisation that owns campaigns and data.'],
  ['Facebook Page', 'Connect Meta after the workspace is ready.'],
  ['Chrome extension', 'Build and load the extension from apps/chrome-extension/dist.'],
  ['Register device', 'Register the browser or desktop agent from Devices.'],
  ['First group', 'Add only a Facebook Group where you are permitted to post.'],
  ['First content', 'Upload approved media and write accessible alt text.'],
  ['First schedule', 'Choose a destination, caption, and local publishing time.'],
  ['Safe test', 'Use confirmation mode and review the prepared post before publishing.'],
] as const;
export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('My Workspace');
  const [slug, setSlug] = useState('my-workspace');
  const [error, setError] = useState('');
  const current = steps[step]!;
  async function next() {
    setError('');
    if (step === 1 && !isConfigured()) {
      setError(
        'Supabase configuration is missing. Add the two NEXT_PUBLIC_SUPABASE values and restart the web app.',
      );
      return;
    }
    if (step === 2) {
      try {
        const { error: e } = await browserClient().rpc('create_organisation', {
          org_name: name,
          org_slug: slug,
        });
        if (e) throw e;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create workspace');
        return;
      }
    }
    if (step === steps.length - 1) {
      router.push('/dashboard/overview');
      return;
    }
    setStep(step + 1);
  }
  return (
    <main className="auth-shell">
      <section className="card" style={{ width: 'min(720px,100%)', padding: 32 }}>
        <div className="brand">
          <span className="brand-mark">R</span>Rudder setup
        </div>
        <p className="muted" style={{ marginTop: 28 }}>
          Step {step + 1} of {steps.length}
        </p>
        <div style={{ height: 6, background: 'var(--line)', borderRadius: 8 }}>
          <div
            style={{
              width: `${(step + 1) * 10}%`,
              height: '100%',
              background: 'var(--aqua)',
              borderRadius: 8,
            }}
          />
        </div>
        <h1>{current[0]}</h1>
        <p className="muted">{current[1]}</p>
        {step === 2 && (
          <div className="form-grid" style={{ margin: '24px 0' }}>
            <div className="field">
              <label>Workspace name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>URL slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              />
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="notice">
            {isConfigured()
              ? 'Supabase public configuration is present. The connection will be authenticated when you continue.'
              : 'Configuration has not been supplied yet.'}
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30 }}>
          <button className="btn secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Back
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 2 && step < 9 && (
              <button className="btn secondary" onClick={() => setStep(step + 1)}>
                Skip for now
              </button>
            )}
            <button className="btn" onClick={next}>
              {step === 9 ? 'Open dashboard' : 'Continue'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
