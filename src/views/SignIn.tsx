import { useState } from 'react'
import { useAuth } from '../lib/auth'

type Mode = 'signin' | 'signup' | 'reset'

/**
 * The front door. Email and password, because that is what the committee asked
 * for — no magic links to chase, no third-party account needed.
 */
export function SignIn() {
  const auth = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setError(null); setNotice(null); setBusy(true)
    try {
      if (mode === 'signin') {
        const err = await auth.signIn(email, password)
        if (err) setError(err)
      } else if (mode === 'signup') {
        if (password.length < 6) { setError('Please choose a password of at least 6 characters.'); return }
        const res = await auth.signUp(email, password, name)
        if (res.error) setError(res.error)
        else if (res.alreadyRegistered) {
          setNotice(`${email} already has an account, so no email was sent. Sign in below — or use “Forgot your password?” if you do not remember the password.`)
          setMode('signin')
        }
        else if (res.needsConfirmation) {
          setNotice(`Almost there. We have emailed a confirmation link to ${email}. Open it, then come back here and sign in.`)
          setMode('signin')
        }
      } else {
        const err = await auth.resetPassword(email)
        if (err) setError(err)
        else {
          setNotice(`If an account exists for ${email}, a password reset link is on its way.`)
          setMode('signin')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-crest" aria-hidden>SPX</div>
          <h1>St. Pius X PSC Portal</h1>
          <p>Parent Standing Committee · Parents Education Committee</p>
        </div>

        {notice && <div className="callout info" style={{ marginBottom: 16 }}>{notice}</div>}
        {error && <div className="callout warn" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <label className="field">
              <span>Your name</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" required autoFocus placeholder="you@example.com"
            />
          </label>

          {mode !== 'reset' && (
            <label className="field">
              <span>Password</span>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required minLength={6}
              />
              {mode === 'signup' && <span className="hint">At least 6 characters.</span>}
            </label>
          )}

          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create my account' : 'Send reset link'}
          </button>
        </form>

        <div className="auth-links">
          {mode === 'signin' && (
            <>
              <button className="linkish" onClick={() => { setMode('signup'); setError(null); setNotice(null) }}>
                First time here? Create an account
              </button>
              <button className="linkish" onClick={() => { setMode('reset'); setError(null); setNotice(null) }}>
                Forgot your password?
              </button>
            </>
          )}
          {mode !== 'signin' && (
            <button className="linkish" onClick={() => { setMode('signin'); setError(null); setNotice(null) }}>
              ← Back to sign in
            </button>
          )}
        </div>

        <p className="auth-foot">
          Access is by invitation. Create an account with the email address the PSC chair has
          authorised — if the portal says you have no access after signing in, ask Jorge to add you.
        </p>
      </div>
      <div className="auth-motto">Reverence · Respect · Responsibility</div>
    </div>
  )
}

/**
 * Shown after arriving from a password-reset email. The recovery session is
 * short-lived, so the new password has to be set here and now.
 */
export function SetNewPassword() {
  const auth = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setError(null)
    if (password.length < 6) { setError('Please choose a password of at least 6 characters.'); return }
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    setBusy(true)
    const err = await auth.updatePassword(password)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-crest" aria-hidden>SPX</div>
          <h1>Choose a new password</h1>
          <p>{auth.email}</p>
        </div>

        {error && <div className="callout warn" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={submit}>
          <label className="field">
            <span>New password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={6} autoFocus />
            <span className="hint">At least 6 characters.</span>
          </label>
          <label className="field">
            <span>Confirm new password</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={6} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
            {busy ? 'Saving…' : 'Save my new password'}
          </button>
        </form>

        <div className="auth-links">
          <button className="linkish" onClick={() => void auth.signOut()}>Cancel and sign out</button>
        </div>
      </div>
      <div className="auth-motto">Reverence · Respect · Responsibility</div>
    </div>
  )
}

/** Signed in, but not on the psc_members roster. */
export function NoAccess() {
  const auth = useAuth()
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-crest" aria-hidden>SPX</div>
          <h1>You’re signed in, but not on the list yet</h1>
        </div>
        <p style={{ fontSize: 14 }}>
          Your account (<strong>{auth.email}</strong>) is not yet authorised for the PSC portal.
          Ask Jorge Chinchilla to add this exact email address, then reload this page.
        </p>
        <p className="hint">
          Nothing is wrong with your account — access is granted per email address so that
          committee data is never visible to anyone who has not been invited.
        </p>
        <button className="btn" onClick={() => void auth.signOut()}>Sign out</button>
      </div>
    </div>
  )
}
