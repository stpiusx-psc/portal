import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { REMOTE_ENABLED, supabase, type Member, type MemberRole } from './supabase'

interface AuthState {
  /** Still working out whether somebody is signed in. */
  loading: boolean
  session: Session | null
  email: string | null
  /** The row from psc_members, or null if this account is not on the roster. */
  member: Member | null
  role: MemberRole | null
  canEdit: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
  resetPassword: (email: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

/** Turn Supabase's terse auth errors into something a parent volunteer can act on. */
function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'That email and password combination did not work. Check for typos, or use “Forgot your password?”.'
  if (m.includes('email not confirmed')) return 'Your email address has not been confirmed yet. Open the confirmation link we emailed you, then sign in.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'There is already an account for that email. Sign in instead, or reset your password.'
  if (m.includes('password should be at least')) return 'Please choose a password of at least 6 characters.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a minute and try again.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Could not reach the server. Check your internet connection and try again.'
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(REMOTE_ENABLED)
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<Member | null>(null)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  const email = session?.user?.email?.toLowerCase() ?? null

  // Look up the roster row. RLS means a non-member simply gets no row back.
  useEffect(() => {
    if (!supabase || !email) { setMember(null); return }
    let cancelled = false
    void supabase
      .from('psc_members')
      .select('email, display_name, role')
      .eq('email', email)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setMember((data as Member) ?? null) })
    return () => { cancelled = true }
  }, [email])

  const signIn = useCallback(async (e: string, password: string) => {
    if (!supabase) return 'This build has no server configured.'
    const { error } = await supabase.auth.signInWithPassword({ email: e.trim().toLowerCase(), password })
    return error ? friendly(error.message) : null
  }, [])

  const signUp = useCallback(async (e: string, password: string, name: string) => {
    if (!supabase) return { error: 'This build has no server configured.', needsConfirmation: false }
    const { data, error } = await supabase.auth.signUp({
      email: e.trim().toLowerCase(),
      password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin + window.location.pathname },
    })
    if (error) return { error: friendly(error.message), needsConfirmation: false }
    // No session back means the project requires email confirmation first.
    return { error: null, needsConfirmation: !data.session }
  }, [])

  const resetPassword = useCallback(async (e: string) => {
    if (!supabase) return 'This build has no server configured.'
    const { error } = await supabase.auth.resetPasswordForEmail(e.trim().toLowerCase(), {
      redirectTo: window.location.origin + window.location.pathname,
    })
    return error ? friendly(error.message) : null
  }, [])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    setMember(null)
  }, [])

  const value = useMemo<AuthState>(() => ({
    loading,
    session,
    email,
    member,
    role: member?.role ?? null,
    canEdit: member?.role === 'admin' || member?.role === 'editor',
    isAdmin: member?.role === 'admin',
    signIn, signUp, resetPassword, signOut,
  }), [loading, session, email, member, signIn, signUp, resetPassword, signOut])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
