import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * The shared backend. `null` when the build has no Supabase configuration, in
 * which case the portal falls back to browser-local storage and says so.
 *
 * The publishable ("anon") key is meant to be in the client bundle — it grants
 * nothing on its own. Access is decided by row-level security against the
 * psc_members roster, so a signed-in stranger sees no PSC data at all.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null

export const REMOTE_ENABLED = supabase !== null

export type MemberRole = 'admin' | 'editor' | 'viewer'

export interface Member {
  email: string
  display_name: string | null
  role: MemberRole
}

/**
 * Whether an authorised person has actually got in yet. Comes from the
 * psc_member_status() function rather than a table, because it reads
 * auth.users, which the client cannot query directly. Administrators only —
 * anybody else gets an empty result.
 */
export interface MemberStatus {
  email: string
  has_account: boolean
  email_confirmed: boolean
  account_created_at: string | null
  last_sign_in_at: string | null
}
