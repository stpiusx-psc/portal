import { useMemo, useState } from 'react'
import type { Store } from '../lib/store'
import type { PscEvent } from '../lib/types'
import { navigate } from '../App'
import { CATEGORY_LABEL, Chip, ConfidenceChip, Empty, PrintHead, money, whenLabel } from '../components/ui'
import { EventEditor } from '../components/EventEditor'
import { formatMonthKey } from '../lib/dates'
import { printView } from '../lib/exporters'

export function EventsView({ store, selectedId }: { store: Store; selectedId?: string }) {
  const selected = store.events.find((e) => e.id === selectedId)
  return selected
    ? <EventDetail event={selected} store={store} />
    : <EventList store={store} />
}

/* ------------------------------------------------------------------- list */

function EventList({ store }: { store: Store }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [show, setShow] = useState<'active' | 'all'>('active')
  const [editing, setEditing] = useState<PscEvent | null>(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return store.events
      .filter((e) => (show === 'all' ? true : e.status === 'active'))
      .filter((e) => (cat === 'all' ? true : e.category === cat))
      .filter((e) =>
        !needle ||
        e.name.toLowerCase().includes(needle) ||
        e.summary.toLowerCase().includes(needle) ||
        e.mainResp.join(' ').toLowerCase().includes(needle) ||
        (e.supportResp ?? []).join(' ').toLowerCase().includes(needle),
      )
      .sort((a, b) => (a.date ?? a.monthHint ?? '9999').localeCompare(b.date ?? b.monthHint ?? '9999'))
  }, [store.events, q, cat, show])

  const withPlaybook = rows.filter((e) => e.playbook?.length).length

  return (
    <>
      <header className="topbar no-print">
        <div>
          <h1>Events &amp; Playbooks</h1>
          <p>
            Every activity the PSC runs, with the run sheet, prior-year numbers and lessons learned behind each one.
            {withPlaybook > 0 && ` ${withPlaybook} events have a full step-by-step playbook.`}
          </p>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={printView}>⎙ Print / PDF</button>
        </div>
      </header>

      <div className="content">
        <PrintHead title="PSC Events" subtitle={`${rows.length} activities`} />

        <div className="toolbar no-print">
          <label className="field grow">
            <span>Search</span>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Event name, summary or person…" />
          </label>
          <label className="field">
            <span>Category</span>
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">All</option>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Show</span>
            <select value={show} onChange={(e) => setShow(e.target.value as 'active' | 'all')}>
              <option value="active">Active only</option>
              <option value="all">Include discontinued &amp; ideas</option>
            </select>
          </label>
        </div>

        {rows.length === 0 ? (
          <Empty icon="⌕" title="Nothing matches">Try a different search or category.</Empty>
        ) : (
          <div className="card">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ minWidth: 210 }}>Event</th>
                    <th style={{ minWidth: 130 }}>When</th>
                    <th style={{ minWidth: 150 }}>Main responsible</th>
                    <th className="num">Budget</th>
                    <th className="num">Last year net</th>
                    <th>Volunteers</th>
                    <th className="no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const last = e.actuals?.find((a) => a.year === '2025') ?? e.actuals?.[0]
                    return (
                      <tr key={e.id}>
                        <td>
                          <button className="linkish" onClick={() => navigate({ view: 'events', id: e.id })}>{e.name}</button>
                          <div className="chips" style={{ marginTop: 4 }}>
                            <Chip category={e.category}>{CATEGORY_LABEL[e.category]}</Chip>
                            {e.majorEvent && <Chip tone="warn">Major</Chip>}
                            {e.status === 'discontinued' && <Chip tone="danger">Discontinued</Chip>}
                            {e.status === 'idea' && <Chip tone="plain">Idea</Chip>}
                            {e.playbook?.length ? <Chip tone="ok">Playbook</Chip> : null}
                          </div>
                        </td>
                        <td>
                          {whenLabel(e)}
                          <div style={{ marginTop: 4 }}><ConfidenceChip c={e.dateConfidence} /></div>
                        </td>
                        <td>
                          {e.mainResp.length ? e.mainResp.join(', ') : <Chip tone="warn">Needs an owner</Chip>}
                          {e.supportResp?.length ? (
                            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 3 }}>
                              +{e.supportResp.length} supporting
                            </div>
                          ) : null}
                        </td>
                        <td className="num">{money(e.budget)}</td>
                        <td className="num">{last?.net != null ? money(last.net) : '—'}</td>
                        <td>
                          {!e.needsVolunteers ? <span style={{ color: 'var(--ink-faint)' }}>—</span>
                            : e.signUpUrl
                              ? <a href={e.signUpUrl} target="_blank" rel="noreferrer">Sign-up{e.volunteerCount ? ` (${e.volunteerCount})` : ''}</a>
                              : <Chip tone="warn">{e.volunteerCount ? `${e.volunteerCount} slots — no link` : 'No link yet'}</Chip>}
                        </td>
                        <td className="no-print">
                          <button className="btn btn-sm" onClick={() => setEditing(e)}>Edit</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {editing && <EventEditor event={editing} store={store} onClose={() => setEditing(null)} onOpenPlaybook={(id) => { setEditing(null); navigate({ view: 'events', id }) }} />}
    </>
  )
}

/* ----------------------------------------------------------------- detail */

function EventDetail({ event: e, store }: { event: PscEvent; store: Store }) {
  const [editing, setEditing] = useState(false)
  const last = e.actuals?.find((a) => a.year === '2025') ?? e.actuals?.[0]

  const prepByMonth = useMemo(() => {
    const map = new Map<string, { task: string; week: string; owner?: string; idx: number; done: boolean }[]>()
    ;(e.prep ?? []).forEach((t, idx) => {
      if (!map.has(t.month)) map.set(t.month, [])
      map.get(t.month)!.push({ task: t.task, week: t.week, owner: t.owner, idx, done: Boolean(t.done) })
    })
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [e.prep])

  const prepTotal = e.prep?.length ?? 0
  const prepDone = (e.prep ?? []).filter((t) => t.done).length

  return (
    <>
      <header className="topbar no-print">
        <div>
          <h1>{e.name}</h1>
          <p>{e.summary}</p>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={() => navigate({ view: 'events' })}>← All events</button>
          <button className="btn" onClick={printView}>⎙ Print playbook</button>
          <button className="btn btn-primary" onClick={() => setEditing(true)}>{store.readOnly ? 'View details' : 'Edit details'}</button>
        </div>
      </header>

      <div className="content">
        <PrintHead title={`${e.name} — Event Playbook`} subtitle={whenLabel(e)} />

        <div className="card card-pad">
          <div className="ev-head">
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="chips">
                <Chip category={e.category}>{CATEGORY_LABEL[e.category]}</Chip>
                <ConfidenceChip c={e.dateConfidence} />
                {e.majorEvent && <Chip tone="warn">Major event — needs a committee</Chip>}
                {e.status === 'discontinued' && <Chip tone="danger">Discontinued</Chip>}
                {e.status === 'idea' && <Chip tone="plain">Idea — not yet approved</Chip>}
                {store.isEdited(e.id) && <Chip tone="ok">Edited in portal</Chip>}
              </div>
              {e.description && <p style={{ marginBottom: 0, marginTop: 12 }}>{e.description}</p>}
            </div>
          </div>

          <div className="ev-meta" style={{ marginTop: 18 }}>
            <div><div className="k">When</div><div className="v">{whenLabel(e)}</div></div>
            <div><div className="k">Main responsible</div><div className="v">{e.mainResp.length ? e.mainResp.join(', ') : '— needs an owner'}</div></div>
            <div><div className="k">Budget</div><div className="v">{money(e.budget)}</div></div>
            <div>
              <div className="k">Volunteers</div>
              <div className="v">
                {e.needsVolunteers ? (e.volunteerCount ? `${e.volunteerCount} slots` : 'Needed') : 'Not required'}
              </div>
            </div>
            {e.priorYearDate && <div><div className="k">Last year</div><div className="v">{e.priorYearDate}</div></div>}
            {last?.net != null && <div><div className="k">{last.year} net</div><div className="v">{money(last.net)}</div></div>}
          </div>

          {e.supportResp?.length ? (
            <>
              <div className="section-title">Support team</div>
              <div className="chips">{e.supportResp.map((p) => <Chip key={p} tone="plain">{p}</Chip>)}</div>
            </>
          ) : null}

          {e.signUpUrl && (
            <>
              <div className="section-title">Volunteer sign-up</div>
              <a className="btn" href={e.signUpUrl} target="_blank" rel="noreferrer">Open sign-up sheet ↗</a>
            </>
          )}

          {e.notes && (
            <>
              <div className="section-title">Notes for {store.schoolYear}</div>
              <div className="callout">{e.notes}</div>
            </>
          )}
        </div>

        {e.actuals?.length ? (
          <div className="card">
            <div className="card-head"><h2>Prior-year results</h2></div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Year</th><th className="num">Revenue</th><th className="num">Costs</th><th className="num">Net</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {e.actuals.map((a) => (
                    <tr key={a.year}>
                      <td><strong>{a.year}</strong></td>
                      <td className="num">{money(a.revenue)}</td>
                      <td className="num">{money(a.costs)}</td>
                      <td className="num"><strong>{money(a.net)}</strong></td>
                      <td style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{a.note ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {prepTotal > 0 && (
          <div className="card">
            <div className="card-head">
              <h2>Preparation timeline</h2>
              <span className="spacer" />
              <Chip tone={prepDone === prepTotal ? 'ok' : 'plain'}>{prepDone} / {prepTotal} done</Chip>
            </div>
            <div className="card-pad">
              {prepByMonth.map(([month, tasks]) => (
                <div key={month} style={{ marginBottom: 14 }}>
                  <div className="section-title" style={{ marginTop: 0 }}>{formatMonthKey(month)}</div>
                  {tasks.map((t) => (
                    <label className={`prep-row${t.done ? ' done' : ''}`} key={t.idx}>
                      <input type="checkbox" checked={t.done} disabled={store.readOnly} onChange={() => store.togglePrep(e.id, t.idx)} />
                      <span className="wk">{t.week}</span>
                      <span className="task">{t.task}</span>
                      {t.owner && <span className="owner">{t.owner}</span>}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {e.playbook?.length ? (
          <div className="card">
            <div className="card-head"><h2>Run sheet</h2></div>
            <div className="card-pad">
              {e.playbook.map((s) => (
                <div className="pb-section" key={s.title}>
                  <h4>{s.title}</h4>
                  <ul>{s.items.map((i, n) => <li key={n}>{i}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {e.lessons?.length ? (
          <div className="card">
            <div className="card-head"><h2>Lessons learned — read before you start</h2></div>
            <div className="card-pad">
              <ul className="plain">{e.lessons.map((l, n) => <li key={n}>{l}</li>)}</ul>
            </div>
          </div>
        ) : null}

        {e.docs?.length ? (
          <div className="card">
            <div className="card-head"><h2>Documents on the shared Drive</h2></div>
            <div className="card-pad">
              <div className="doc-list">
                {e.docs.map((d) => (
                  <a className="doc-item" key={d.url} href={d.url} target="_blank" rel="noreferrer">
                    <span className="kind">{d.kind}</span>
                    <span>
                      {d.title}
                      {d.note && <span className="note"> — {d.note}</span>}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {editing && <EventEditor event={e} store={store} onClose={() => setEditing(false)} />}
    </>
  )
}
