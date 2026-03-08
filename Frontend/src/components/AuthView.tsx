import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from "react";
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type AuthMode = 'signin' | 'signup'

type Props = {
  mode: AuthMode
}

export function AuthView({ mode }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const title = useMemo(() => (mode === 'signin' ? 'Sign in' : 'Create your account'), [mode])
  const subtitle = useMemo(
    () => (mode === 'signin' ? 'Welcome back. Pick up where you left off.' : 'Start using QuickTasks in under a minute.'),
    [mode],
  )

  useEffect(() => {
    if (!error) return
    const id = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(id)
  }, [error])

  useEffect(() => {
    if (!message) return
    const id = window.setTimeout(() => setMessage(null), 5000)
    return () => window.clearTimeout(id)
  }, [message])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLoadingLabel(mode === 'signin' ? 'Signing in…' : 'Creating account…')
    setMessage(null)
    setError(null)

    try {
      if (mode === 'signin') {
        // Supabase persists sessions by default. We keep "Remember me" as UX only for now;
        // we could later wire it to session persistence settings if needed.
        void rememberMe
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      } else {
        const {
          data,
          error: signUpError,
        } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError

        if (data.user) {
          // Create a basic user profile row; requires a `profiles` table in Supabase
          await supabase.from('profiles').insert({
            id: data.user.id,
            email: data.user.email,
          })
        }

        setMessage('Account created. Check your inbox to confirm your email before signing in.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
      setLoadingLabel(null)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    setLoadingLabel('Continuing with Google…')
    setError(null)
    setMessage(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (signInError) throw signInError
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
      setLoadingLabel(null)
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setError('Enter your email first to receive a reset link.')
      return
    }
    setLoading(true)
    setLoadingLabel('Sending reset link…')
    setError(null)
    setMessage(null)
    try {
      const rawBase = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
      const apiBase = rawBase.replace(/\/$/, '')
      const res = await fetch(`${apiBase}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Could not send reset email. Please try again.')
      }
      setMessage('Password reset email sent. Check your inbox.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send reset email. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
      setLoadingLabel(null)
    }
  }

  return (
    <div className="auth-shell">
      <div className={`auth-card ${mode === 'signin' ? 'auth-card--signin' : ''}`}>
        {mode === 'signin' || mode === 'signup' ? (
          <header className="auth-header auth-header--signin">
            <div className="auth-brand">
              <img className="auth-brand-logo" src="/quicktasks-logo.svg" alt="QuickTasks logo" />
              <span className="auth-brand-name">QuickTasks</span>
            </div>
            <h1 className="auth-title">{title}</h1>
            {mode === 'signup' && <p className="auth-subtitle">{subtitle}</p>}
          </header>
        ) : (
          <header className="auth-header">
            <div className="app-mark">
              <img src="/quicktasks-logo.svg" alt="QuickTasks logo" />
            </div>
            <div>
              <h1 className="app-title">{title}</h1>
              <p className="app-subtitle">{subtitle}</p>
            </div>
          </header>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Create a strong password' : 'Enter your password'}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg
                    className="password-toggle-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M4.5 4.5 19.5 19.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9.88 9.88A3 3 0 0 1 14.12 14.12"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6.46 6.46C4.59 7.59 3.14 9.3 2.25 11.25 3.75 14.75 7.5 17.25 12 17.25c1.12 0 2.2-.16 3.22-.46"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M17.54 17.54C19.41 16.41 20.86 14.7 21.75 12.75 20.25 9.25 16.5 6.75 12 6.75c-.7 0-1.38.06-2.03.18"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    className="password-toggle-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.25 12C3.75 8.5 7.5 6 12 6s8.25 2.5 9.75 6c-1.5 3.5-5.25 6-9.75 6s-8.25-2.5-9.75-6Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {mode === 'signin' && (
            <label className="remember-row">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
          )}

          <button
            type="submit"
            className={`primary-btn ${mode === 'signin' || mode === 'signup' ? 'primary-btn--light' : ''}`}
            disabled={loading}
          >
            {loading ? (loadingLabel ?? 'Working…') : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {mode === 'signin' && (
          <button type="button" className="link-btn link-btn--strong" onClick={handleResetPassword} disabled={loading}>
            Forgot your password?
          </button>
        )}

        {mode === 'signin' && <div className="auth-divider"><span>or</span></div>}

        <button
          type="button"
          className={`ghost-btn google-btn ${mode === 'signin' ? 'google-btn--signin' : ''}`}
          onClick={handleGoogle}
          disabled={loading}
        >
          <span className="google-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="18" height="18">
              <path
                fill="#FFC107"
                d="M43.611 20.083H42V20H24v8h11.303C33.662 32.659 29.229 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.962 3.038l5.657-5.657C34.046 6.053 29.268 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.651-.389-3.917Z"
              />
              <path
                fill="#FF3D00"
                d="M6.306 14.691 12.88 19.51C14.66 15.108 19.064 12 24 12c3.059 0 5.842 1.154 7.962 3.038l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.343 4.326-17.694 10.691Z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.94 11.94 0 0 1 24 36c-5.208 0-9.63-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44Z"
              />
              <path
                fill="#1976D2"
                d="M43.611 20.083H42V20H24v8h11.303a12.05 12.05 0 0 1-4.084 5.57l.003-.002 6.19 5.238C36.97 39.205 44 34 44 24c0-1.341-.138-2.651-.389-3.917Z"
              />
            </svg>
          </span>
          {mode === 'signin' ? 'Sign in with Google' : 'Continue with Google'}
        </button>

        {message && <p className="banner banner-success">{message}</p>}
        {error && <p className="banner banner-error">{error}</p>}

        <p className="switch-auth">
          {mode === 'signin' ? (
            <>
              New to QuickTasks? <Link to="/signup">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/signin">Sign in</Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

