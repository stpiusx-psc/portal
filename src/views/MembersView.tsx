import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { REMOTE_ENABLED, supabase, type Member, type MemberRole } from '../lib/supabase'
import { Banner, Chip, Empty } from '../components/ui'

const ROLE_HELP: Record<MemberRole, string> = {
  admin: 'Full access, and can invite or remove people.',
  editor: 'Can change dates, owners, budgets, reports and notes.',
  viewer: 'Can see everything but change nothing.',
}

/**
 * Who may use the portal. Access is granted by email address, so somebody can
 * be authorised before they have ever created an account — which is how a new
 * committee member gets invited without waiting on anybody.
 */
export function MembersView() {
  const auth = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<MemberRole>('editor')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const { data, error } = await supabase
      .from('psc_members')
      .select('email, display_name, role')
      .order('role')
    if (error) setMsg({ tone: 'warn', text: `Could not load the list: ${error.message}` })
    else setMembers((data as Member[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const add = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!supabase) return
    const clean = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setMsg({ tone: 'warn', text: 'That does not look like an email address.' })
      return
    }
    setBusy(true)
    const { error } = await supabase
      .from('psc_members')
      .upsert({ email: clean, display_name: name.trim() || null, role }, { onConflict: 'email' })
    setBusy(false)
    if (error) {
      setMsg({ tone: 'warn', text: `Could not save: ${error.message}` })
      return
    }
    setMsg({
      tone: 'info',
      text: `${clean} is authorised. Tell them to open the portal, choose “Create an account” and sign up with exactly that address.`,
    })
    setEmail(''); setName('')
    void load()
  }

  const remove = async (target: string) => {
    if (!supabase) return
    const { error } = await supabase.from('psc_members').delete().eq('email', target)
    if (error) setMsg({ tone: 'warn', text: `Could not remove: ${error.message}` })
    else {
      setMsg({ tone: 'info', text: `${target} no longer has access.` })
      void load()
    }
  }

  const changeRole = async (target: string, next: MemberRole) => {
    if (!supabase) return
    const { error } = await supabase.from('psc_members').update({ role: next }).eq('email', target)
    if (error) setMsg({ tone: 'warn', text: `Could not update: ${error.message}` })
    else void load()
  }

  if (!REMOTE_ENABLED) {
    return (
      <>
        <header className="topbar no-print"><div><h1>People &amp; Access</h1></div></header>
        <div className="content">
          <Empty icon="⚿" title="No server configured">
            This build stores everything in your browser, so there is nobody to invite.
          </Empty>
        </div>
      </>
    )
  }

  if (!auth.isAdmin) {
    return (
      <>
        <header className="topbar no-print"><div><h1>People &amp; Access</h1></div></header>
        <div className="content">
          <Empty icon="⚿" title="Administrators only">
            Ask Jorge Chinchilla to invite somebody or change an access level.
          </Empty>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="topbar no-print">
        <div>
          <h1>People &amp; Access</h1>
          <p>
            Who can open the portal. Access is granted by email address — you can authorise
            somebody before they have created an account.
          </p>
        </div>
      </header>

      <div className="content">
        {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}

        <div className="card">
          <div className="card-head"><h2>Invite somebody</h2></div>
          <div className="card-pad">
            <form onSubmit={add}>
              <div className="grid grid-3">
                <label className="field">
                  <span>Email address</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cfrancis@saintpius.ca" required />
                </label>
                <label className="field">
                  <span>Name (optional)</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Charlaine Francis" />
                </label>
                <label className="field">
                  <span>Access level</span>
                  <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
                    <option value="editor">Editor — can change things</option>
                    <option value="viewer">Viewer — read only</option>
                    <option value="admin">Administrator — can also invite</option>
                  </select>
                  <span className="hint">{ROLE_HELP[role]}</span>
                </label>
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Authorise this email'}
              </button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Who has access</h2>
            <span className="spacer" />
            <Chip tone="plain">{members.length}</Chip>
          </div>
          {loading ? (
            <div className="card-pad" style={{ color: 'var(--ink-muted)' }}>Loading…</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Email</th><th>Name</th><th style={{ width: 210 }}>Access level</th><th></th></tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const isSelf = m.email === auth.email
                    return (
                      <tr key={m.email}>
                        <td><strong>{m.email}</strong>{isSelf && <> <Chip tone="ok">you</Chip></>}</td>
                        <td>{m.display_name ?? '—'}</td>
                        <td>
                          <select
                            value={m.role}
                            disabled={isSelf}
                            onChange={(e) => void changeRole(m.email, e.target.value as MemberRole)}
                          >
                            <option value="admin">Administrator</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          {isSelf && <span className="hint">You cannot change your own level.</span>}
                        </td>
                        <td>
                          {!isSelf && (
                            <button className="btn btn-sm btn-danger" onClick={() => void remove(m.email)}>Remove</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="callout info">
          <strong>How to bring Ms. Francis in later:</strong> authorise <code>cfrancis@saintpius.ca</code>
          {' '}above as a Viewer or Editor, then send her the portal link. She creates her own password
          on first use. Nothing else is needed.
        </div>
      </div>
    </>
  )
}
