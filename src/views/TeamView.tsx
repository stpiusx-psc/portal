import { useMemo, useState } from 'react'
import type { Store } from '../lib/store'
import type { TeamMember } from '../lib/types'
import { navigate } from '../App'
import { Chip, Empty, PrintHead } from '../components/ui'
import { DRIVE_ROOT } from '../data/events'
import { printView } from '../lib/exporters'

/** Suggested positions, but the field accepts anything. */
const TITLES = ['PSC Chair', 'Committee', 'School Principal', 'PEC Liaison', 'Coordinator']

export function TeamView({ store }: { store: Store }) {
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [assigning, setAssigning] = useState<TeamMember | null>(null)
  const [adding, setAdding] = useState(false)

  /** Who leads and supports what, read live from the events. */
  const ownership = useMemo(() => {
    const map = new Map<string, { lead: string[]; support: string[] }>()
    const put = (person: string, key: 'lead' | 'support', eventName: string) => {
      const k = person.toLowerCase()
      if (!map.has(k)) map.set(k, { lead: [], support: [] })
      map.get(k)![key].push(eventName)
    }
    for (const e of store.events) {
      if (e.status === 'discontinued') continue
      for (const p of e.mainResp) put(p, 'lead', e.name)
      for (const p of e.supportResp ?? []) put(p, 'support', e.name)
    }
    return map
  }, [store.events])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return store.team
      .filter((m) => (showInactive ? true : m.active !== false))
      .filter((m) => {
        if (!needle) return true
        const own = ownership.get(m.name.toLowerCase())
        const hay = [m.name, m.role, ...m.involvement, ...(own?.lead ?? []), ...(own?.support ?? [])]
        return hay.join(' ').toLowerCase().includes(needle)
      })
      .map((m) => ({ ...m, own: ownership.get(m.name.toLowerCase()) }))
  }, [store.team, q, showInactive, ownership])

  /** People credited on an event but missing from the roster. */
  const orphans = useMemo(() => {
    const known = new Set(store.team.map((m) => m.name.toLowerCase()))
    const out = new Set<string>()
    for (const e of store.events) {
      for (const p of [...e.mainResp, ...(e.supportResp ?? [])]) {
        if (!known.has(p.toLowerCase())) out.add(p)
      }
    }
    return [...out].sort()
  }, [store.events, store.team])

  const unassigned = store.events.filter((e) => e.status === 'active' && e.mainResp.length === 0)
  const inactiveCount = store.team.filter((m) => m.active === false).length

  return (
    <>
      <header className="topbar no-print">
        <div>
          <h1>Team &amp; Roles</h1>
          <p>
            Who is on the committee and what they own. Add new parents, retire the ones who have left,
            and assign events straight from here — assignments are written to the event itself, so the
            calendar can never disagree with this page.
          </p>
        </div>
        <div className="topbar-actions">
          {!store.readOnly && <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add a member</button>}
          <button className="btn" onClick={printView}>⎙ Print / PDF</button>
        </div>
      </header>

      <div className="content">
        <PrintHead title="PSC Team & Roles" subtitle={`${rows.length} committee members`} />

        <div className="callout info" style={{ marginBottom: 18 }}>
          <strong>Contact details are deliberately not stored here.</strong> Emails and phone numbers stay in the
          access-controlled <a href={DRIVE_ROOT} target="_blank" rel="noreferrer">PSC Contact List on the shared Drive</a>,
          so this portal can be shared without circulating parents’ personal information.
        </div>

        {unassigned.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h2>Events with no lead</h2>
              <span className="spacer" />
              <Chip tone="warn">{unassigned.length}</Chip>
            </div>
            <div className="month-list">
              {unassigned.map((e) => (
                <div className="month-row" key={e.id}>
                  <div className="what">
                    <button className="linkish" onClick={() => navigate({ view: 'events', id: e.id })}>{e.name}</button>
                  </div>
                  <div className="who">{e.summary.slice(0, 60)}…</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {orphans.length > 0 && (
          <div className="callout warn" style={{ marginBottom: 16 }}>
            <strong>Credited on an event but not on the roster:</strong> {orphans.join(', ')}.
            {!store.readOnly && ' Add them above so their events show up against their name.'}
          </div>
        )}

        <div className="toolbar no-print">
          <label className="field grow">
            <span>Search</span>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, position or event…" />
          </label>
          {inactiveCount > 0 && (
            <label className="field">
              <span>Past members</span>
              <select value={showInactive ? 'yes' : 'no'} onChange={(e) => setShowInactive(e.target.value === 'yes')}>
                <option value="no">Current members only</option>
                <option value="yes">Include {inactiveCount} past member{inactiveCount === 1 ? '' : 's'}</option>
              </select>
            </label>
          )}
        </div>

        {rows.length === 0 ? (
          <Empty icon="⌕" title="Nobody matches">Try a different search.</Empty>
        ) : (
          <div className="card">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ minWidth: 165 }}>Name</th>
                    <th style={{ minWidth: 140 }}>Position</th>
                    <th>Leads this year</th>
                    <th>Supports</th>
                    <th className="no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id ?? m.name} style={m.active === false ? { opacity: .55 } : undefined}>
                      <td>
                        <strong>{m.name}</strong>
                        {m.active === false && <> <Chip tone="plain">past member</Chip></>}
                      </td>
                      <td>{m.role}</td>
                      <td>
                        {m.own?.lead.length
                          ? <div className="chips">{m.own.lead.map((n) => <Chip key={n} tone="ok">{n}</Chip>)}</div>
                          : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                      </td>
                      <td>
                        {m.own?.support.length
                          ? <div className="chips">{m.own.support.map((n) => <Chip key={n} tone="plain">{n}</Chip>)}</div>
                          : m.involvement.length
                            ? <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{m.involvement.join(' · ')}</span>
                            : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                      </td>
                      <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                        {!store.readOnly && (
                          <>
                            <button className="btn btn-sm" onClick={() => setAssigning(m)}>Events</button>{' '}
                            <button className="btn btn-sm" onClick={() => setEditing(m)}>Edit</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-head"><h2>PSC meeting schedule</h2></div>
          <div className="month-list">
            {store.meetings.map((m) => (
              <div className="month-row" key={m.id}>
                <div className="when">{m.date}</div>
                <div className="what">
                  {m.kind} meeting
                  {m.note && <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>{m.note}</div>}
                </div>
                <div className="who">{m.time} · {m.location}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(editing || adding) && (
        <MemberEditor
          member={editing ?? { name: '', role: 'Committee', active: true, involvement: [], sortOrder: 1000 }}
          store={store}
          isNew={adding}
          onClose={() => { setEditing(null); setAdding(false) }}
        />
      )}

      {assigning && (
        <AssignmentEditor member={assigning} store={store} onClose={() => setAssigning(null)} />
      )}
    </>
  )
}

/* --------------------------------------------------------- member add/edit */

function MemberEditor({ member, store, isNew, onClose }: { member: TeamMember; store: Store; isNew: boolean; onClose: () => void }) {
  const [name, setName] = useState(member.name)
  const [role, setRole] = useState(member.role)
  const [active, setActive] = useState(member.active !== false)
  const [note, setNote] = useState(member.involvement.join(', '))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const leads = store.events.filter(
    (e) => e.status !== 'discontinued' && e.mainResp.some((p) => p.toLowerCase() === member.name.toLowerCase()),
  )

  const save = async () => {
    setBusy(true)
    const err = await store.saveTeamMember(
      {
        ...member,
        name,
        role: role.trim() || 'Committee',
        active,
        involvement: note.split(',').map((x) => x.trim()).filter(Boolean),
      },
      isNew ? undefined : member.name,
    )
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  const remove = async () => {
    setBusy(true)
    const err = await store.deleteTeamMember(member)
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <div className="modal-backdrop no-print" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><h2>{isNew ? 'Add a committee member' : member.name}</h2></div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span>Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Maria Gonzalez" />
            {!isNew && name !== member.name && (
              <span className="hint">
                Renaming also updates this person on every event they are credited on.
              </span>
            )}
          </label>

          <label className="field">
            <span>Position on the committee</span>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} list="psc-titles" placeholder="Committee" />
            <datalist id="psc-titles">{TITLES.map((t) => <option key={t} value={t} />)}</datalist>
            <span className="hint">This is their committee position, not their portal access level.</span>
          </label>

          <label className="field">
            <span>Status</span>
            <select value={active ? 'active' : 'past'} onChange={(e) => setActive(e.target.value === 'active')}>
              <option value="active">Current member</option>
              <option value="past">Past member — no longer at the school</option>
            </select>
            <span className="hint">
              Marking somebody as past keeps the history intact instead of deleting them.
            </span>
          </label>

          <label className="field">
            <span>Areas of interest (optional)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Christmas Craft Fair, Hot Lunch" />
            <span className="hint">
              Free text. Actual event assignments are set with the <strong>Events</strong> button.
            </span>
          </label>

          {!isNew && leads.length > 0 && (
            <div className="callout warn">
              {member.name} currently leads {leads.length} event{leads.length === 1 ? '' : 's'}:{' '}
              {leads.map((e) => e.name).join(', ')}. Reassign these before removing them.
            </div>
          )}

          {error && <div className="callout warn">{error}</div>}
        </div>

        <div className="modal-foot">
          {!isNew && (
            confirmDelete ? (
              <>
                <strong style={{ fontSize: 13 }}>Remove permanently?</strong>
                <button className="btn btn-danger" onClick={() => void remove()} disabled={busy}>Yes, remove</button>
                <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </>
            ) : (
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Remove from roster</button>
            )
          )}
          <span style={{ marginLeft: 'auto' }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Add member' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------ event assignments */

function AssignmentEditor({ member, store, onClose }: { member: TeamMember; store: Store; onClose: () => void }) {
  const events = store.events.filter((e) => e.status !== 'discontinued')
  const isOn = (e: (typeof events)[number], as: 'lead' | 'support') =>
    (as === 'lead' ? e.mainResp : e.supportResp ?? []).some((p) => p.toLowerCase() === member.name.toLowerCase())

  const leadCount = events.filter((e) => isOn(e, 'lead')).length
  const supportCount = events.filter((e) => isOn(e, 'support')).length

  return (
    <div className="modal-backdrop no-print" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{member.name} — event assignments</h2>
            <div className="chips" style={{ marginTop: 6 }}>
              <Chip tone="ok">{leadCount} leading</Chip>
              <Chip tone="plain">{supportCount} supporting</Chip>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <p className="hint" style={{ marginTop: 0 }}>
            Ticking a box writes straight to the event, so the calendar, the playbook and this page
            always show the same thing.
          </p>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Event</th>
                  <th style={{ width: 70, textAlign: 'center' }}>Leads</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Supports</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.name}
                      {e.mainResp.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>
                          led by {e.mainResp.join(', ')}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        style={{ width: 'auto', accentColor: 'var(--spx-green-700)' }}
                        checked={isOn(e, 'lead')}
                        aria-label={`${member.name} leads ${e.name}`}
                        onChange={(ev) => store.setAssignment(e.id, member.name, 'lead', ev.target.checked)}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        style={{ width: 'auto', accentColor: 'var(--spx-green-700)' }}
                        checked={isOn(e, 'support')}
                        aria-label={`${member.name} supports ${e.name}`}
                        onChange={(ev) => store.setAssignment(e.id, member.name, 'support', ev.target.checked)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-foot">
          <span style={{ marginLeft: 'auto' }} />
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
