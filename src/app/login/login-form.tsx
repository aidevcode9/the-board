'use client';

import { LoginBrandLockup } from '@/app/brand-logo';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

// Login form — DESIGN_SYSTEM.md: "Retro-Future Lab" aesthetic.
// Flow: enter beta code → validate → Google sign-in.

export function LoginForm() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  async function handleValidateCode() {
    if (!code.trim()) return;
    setStatus('validating');
    setErrorMsg('');

    const res = await fetch('/api/auth/beta-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    });

    if (res.ok) {
      setStatus('ready');
    } else {
      const data = (await res.json()) as { error?: string };
      setErrorMsg(data.error ?? 'Invalid invite code');
      setStatus('error');
    }
  }

  async function handleGoogleSignIn() {
    setSigningIn(true);
    await signIn('google', { callbackUrl: '/' });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-board-bg px-4">
      <div className="w-full max-w-sm">
        <LoginBrandLockup />

        {/* Card */}
        <div className="rounded-lg border border-board-border bg-board-card p-8 shadow-2xl">
          {status !== 'ready' ? (
            /* Step 1: Beta code entry */
            <div>
              <label
                htmlFor="beta-code"
                className="font-data mb-2 block text-[10px] uppercase tracking-widest text-text-muted"
              >
                Invite Code
              </label>
              <input
                id="beta-code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (status === 'error') setStatus('idle');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleValidateCode();
                }}
                placeholder="BOARD-XXXX-XXXX"
                className="font-data mb-1 w-full rounded border border-board-border bg-board-bg px-4 py-3 text-sm uppercase tracking-widest text-text-primary placeholder-text-dim focus:border-accent focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              {status === 'error' && (
                <p className="font-data mt-1 text-[11px] text-danger">{errorMsg}</p>
              )}
              <button
                type="button"
                onClick={() => void handleValidateCode()}
                disabled={status === 'validating' || !code.trim()}
                className="mt-4 w-full rounded bg-accent px-4 py-3 font-data text-[11px] uppercase tracking-widest text-board-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {status === 'validating' ? 'Validating...' : 'Validate Code'}
              </button>
            </div>
          ) : (
            /* Step 2: Google sign-in (code validated) */
            <div>
              <p className="font-data mb-6 text-center text-[11px] uppercase tracking-widest text-success">
                Code Accepted
              </p>
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={signingIn}
                className="flex w-full items-center justify-center gap-3 rounded border border-board-border bg-board-bg px-4 py-3 font-data text-[11px] uppercase tracking-widest text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {signingIn ? 'Redirecting...' : 'Continue with Google'}
              </button>
            </div>
          )}
        </div>

        <p className="font-data mt-6 text-center text-[10px] text-text-dim">
          Beta access only. Contact an admin for an invite code.
        </p>
      </div>
    </main>
  );
}
