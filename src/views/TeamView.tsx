import { useMemo, useState } from 'react'
import type { Store } from '../lib/store'
import { navigate } from '../App'
import { Chip, PrintHead } from '../components/ui'
import { DRIVE_ROOT } from '../data/events'
import { printView } from '../lib/exporters'

export function TeamView({ store }: { store: Store }) {
  const [q, setQ] = useState('')

  /** Who owns what, derived from the live events rather than a static list. */
  const ownership = useMemo(() => {
    const map = new Map<string, { lead: string[]; support: string[] }>()
    for (const e of store.events) {
      if (e.status === 'discontinued') continue
      for (const p of e.mainResp) {
        if (!map.has(p)) map.set(p, { lead: [], support: [] })
        map.get(p)!.lead.push(e.name)
      }
      for (const p of e.supportResp ?? []) {
        if (!map.has(p)) map.set(p, { lead: [], support: [] })
        map.get(p)!.support.push(e.name)
      }
    }
    return map
  }, [store.events])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return store.team
      .filter((m) =>
        !needle ||
        m.name.toLowerCase().includes(needle) ||
        m.role.toLowerCase().includes(needle) ||
        m.involvement.join(' ').toLowerCase().includes(needle),
      )
      .map((m) => ({ ...m, own: ownership.get(m.name) }))
  }, [store.team, q, ownership])

  const unassigned = store.events.filter((e) => e.status === 'active' && e.mainResp.length === 0)

  return (
    <>
      <header className="topbar no-print">
        <div>
          <h1>Team &amp; Roles</h1>
          <p>
            Who is on the committee and what they own this year. Ownership is read live from the events, so it stays
            true as you reassign things on the calendar.
          </p>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={printView}>⎙ Print / PDF</button>
        </div>
      </header>

      <div className="content">
        <PrintHead title="PSC Team & Roles" subtitle={`${store.team.length} committee members`} />

        <div className="callout info" style={{ marginBottom: 18 }}>
          <strong>Contact details are deliberately not stored here.</strong> Emails and phone numbers stay in the
          access-controlled <a href={`${DRIVE_ROOT}`} target="_blank" rel="noreferrer">PSC Contact List on the shared Drive</a>,
          so this portal can be shared without circulating parents’ personal information.
        </div>

        {unassigned.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h2>Events with no owner</h2>
              <span className="spacer" />
              <Chip tone="warn">{unassigned.length}</Chip>
            </div>
            <div className="month-list">
              {unassigned.map((e) => (
                <div className="month-row" key={e.id}>
                  <div className="what">
                    <button className="linkish" onClick={() => navigate({ view: 'events', id: e.id })}>{e.name}</button>
                  </div>
                  <div className="who">{e.summary.slice(0, 70)}…</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="toolbar no-print">
          <label className="field grow">
            <span>Search</span>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, role or event…" />
          </label>
        </div>

        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth: 170 }}>Name</th>
                  <th style={{ minWidth: 150 }}>Role</th>
                  <th>Leads this year</th>
                  <th>Supports</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.name}>
                    <td><strong>{m.name}</strong></td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
    </>
  )
}
