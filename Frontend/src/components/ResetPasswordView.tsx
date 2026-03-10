import { useEffect, useState } from 'react'
import type { FormEvent } from "react";
import { Link } from 'react-router-dom'

type Props = {
  onDone: () => void
}

export function ResetPasswordView({ onDone }: Props) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const tokenParam = url.searchParams.get('token')
    const emailParam = url.searchParams.get('email')

    if (!tokenParam || !emailParam) {
      setError('Invalid or missing password reset link.')
      return
    }

    setToken(tokenParam)
    setEmail(emailParam)
  }, [])

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
    setError(null)
    setMessage(null)

    if (!password || password.length < 8) {
      setError('Use at least 8 characters for your new password.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!token || !email) {
      setError('This password reset link is invalid or has expired.')
      return
    }

    setLoading(true)

    try {
      const rawBase = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
      const apiBase = rawBase.replace(/\/$/, '')
      const res = await fetch(`${apiBase}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword: password }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Could not update password. Please try again.')
      }

      setMessage('Your password has been updated. You can now sign in with your new password.')
      setPassword('')
      setConfirmPassword('')
      onDone()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update password. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleBackToSignIn() {
    onDone()
  }

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card--signin">
        <header className="auth-header auth-header--signin">
          <div className="auth-brand">
            <img className="auth-brand-logo" src="/quicktasks-logo.svg" alt="QuickTasks logo" />
            <span className="auth-brand-name">QuickTasks</span>
          </div>
          <h1 className="auth-title">Reset password</h1>
          <p className="auth-subtitle">Choose a new password for your account.</p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>New password</span>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
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

          <label className="field">
            <span>Confirm password</span>
            <div className="password-input">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
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

          <button type="submit" className="primary-btn primary-btn--light" disabled={loading}>
            {loading ? 'Updating password…' : 'Update password'}
          </button>
        </form>

        {message && <p className="banner banner-success">{message}</p>}
        {error && <p className="banner banner-error">{error}</p>}

        <button type="button" className="link-btn link-btn--strong" onClick={handleBackToSignIn} disabled={loading}>
          <Link to="/signin"> Back to sign in</Link>
        </button>
      </div>
    </div>
  )
}

