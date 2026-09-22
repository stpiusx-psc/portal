import type { Store } from '../lib/store'
import { navigate } from '../App'
import { Banner, Chip, ConfidenceChip, Empty, Stat, money, whenLabel } from '../components/ui'
import { daysBetween, formatLong, todayISO } from '../lib/dates'

export function Dashboard({ store }: { store: Store }) {
  const today = todayISO()
  const active = store.events.filter((e) => e.status === 'active')

  const dated = active
    .filter((e): e is typeof e & { date: string } => Boolean(e.date))
    .sort((a, b) => a.date.localeCompare(b.date))
  const upcoming = dated.filter((e) => e.date >= today).slice(0, 6)

  const nextPsc = dated.filter((e) => e.id.startsWith('psc-20') && e.date >= today)[0]

  const needsDate = active.filter((e) => e.dateConfidence !== 'confirmed')
  const needsOwner = active.filter((e) => e.needsVolunteers && e.mainResp.length === 0)
  const needsSignup = active.filter((e) => e.needsVolunteers && !e.signUpUrl)

  const budgeted = active.reduce((s, e) => s + (e.budget ?? 0), 0)
  const lastYearNet = store.events.reduce((s, e) => {
    const a = e.actuals?.find((x) => x.year === '2025')
    return s + (a?.net ?? 0)
  }, 0)

  return (
    <>
      <header className="topbar no-print">
        <div>
          <h1>Dashboard</h1>
          <p>
            Everything the PSC is running this year, and what still needs a decision. School year {store.schoolYear}.
          </p>
        </div>
      </header>

      <div className="content">
        {needsDate.length > 0 && (
          <Banner tone="warn">
            <span>
              <strong>{needsDate.length} of {active.length} events still have an unconfirmed date.</strong>{' '}
              Some dates come from the school's tentative calendar; others still need agreeing with Ms. Francis. Check the event notes before sharing dates as final.
            </span>
            <span className="spacer" />
            <button className="btn btn-sm" onClick={() => navigate({ view: 'calendar' })}>Review calendar</button>
          </Banner>
        )}

        <div className="grid grid-3">
          <Stat label="Active events" value={active.length} sub={`${active.filter((e) => e.majorEvent).length} major events needing a committee`} />
          <Stat label="Next PSC meeting" value={nextPsc ? formatLong(nextPsc.date) : '—'} sub={nextPsc ? nextPsc.summary : 'No meetings scheduled'} />
          <Stat label="Budget assigned" value={money(budgeted)} sub={`${active.filter((e) => e.budget != null).length} events have a budget set`} />
          <Stat label="2025-26 net result" value={money(lastYearNet)} sub="Recorded actuals from the shared Drive" />
        </div>

        <div className="split" style={{ marginTop: 20 }}>
          <div className="card">
            <div className="card-head">
              <h2>Coming up</h2>
              <span className="spacer" />
              <button className="btn btn-sm" onClick={() => navigate({ view: 'calendar' })}>Full calendar</button>
            </div>
            {upcoming.length === 0 ? (
              <Empty icon="✧" title="Nothing dated ahead">
                All remaining events still need dates. Open the calendar to set them.
              </Empty>
            ) : (
              <div className="month-list">
                {upcoming.map((e) => {
                  const days = daysBetween(today, e.date)
                  return (
                    <div className="month-row" key={e.id}>
                      <div className="when">{formatLong(e.date).slice(0, 10)}</div>
                      <div className="what">
                        <button className="linkish" onClick={() => navigate({ view: 'events', id: e.id })}>{e.name}</button>
                        <div style={{ marginTop: 3 }} className="chips">
                          <Chip category={e.category}>{e.mainResp.length ? e.mainResp[0] : 'No owner'}</Chip>
                          <ConfidenceChip c={e.dateConfidence} />
                        </div>
                      </div>
                      <div className="who">{days === 0 ? 'today' : `in ${days} d`}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head"><h2>Needs a decision</h2></div>
            <div className="card-pad">
              <ActionGroup
                title="No owner yet"
                items={needsOwner.map((e) => e.name)}
                cap={6}
                empty="Every active event has a named lead."
                onOpen={() => navigate({ view: 'events' })}
              />
              <ActionGroup
                title="Volunteers needed, no sign-up link"
                items={needsSignup.map((e) => e.name)}
                cap={6}
                empty="Every event that needs volunteers has a sign-up link."
                onOpen={() => navigate({ view: 'events' })}
              />
              <ActionGroup
                title="Date not confirmed"
                items={needsDate.map((e) => `${e.name} — ${whenLabel(e)}`)}
                empty="All dates confirmed."
                cap={6}
                onOpen={() => navigate({ view: 'calendar' })}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>PEC liaison</h2>
            <span className="spacer" />
            <button className="btn btn-sm" onClick={() => navigate({ view: 'reports' })}>Build a PEC report</button>
            <button className="btn btn-sm" onClick={() => navigate({ view: 'pec-meeting' })}>Take PEC meeting notes</button>
          </div>
          <div className="card-pad">
            <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 14 }}>
              The monthly rhythm: Lynda sends the PSC agenda or minutes → paste it into <strong>PEC Reports</strong> to draft
              the summary for the PEC meeting → take notes during the PEC meeting in <strong>PEC Meeting Notes</strong> →
              send the feedback email back to Lynda.
            </p>
            {store.reports.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="section-title" style={{ marginTop: 0 }}>Saved reports</div>
                <div className="month-list" style={{ padding: 0 }}>
                  {store.reports.slice(0, 4).map((r) => (
                    <div className="month-row" key={r.id}>
                      <div className="what">
                        <button className="linkish" onClick={() => navigate({ view: 'reports' })}>{r.title}</button>
                      </div>
                      <div className="who">{r.createdAt.slice(0, 10)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function ActionGroup({ title, items, empty, cap = 6, onOpen }: { title: string; items: string[]; empty: string; cap?: number; onOpen: () => void }) {
  const shown = items.slice(0, cap)
  const more = items.length - shown.length
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>{title}</div>
        {items.length > 0 && <Chip tone="warn">{items.length}</Chip>}
      </div>
      {items.length === 0 ? (
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-faint)' }}>{empty}</p>
      ) : (
        <>
          <ul className="plain" style={{ marginTop: 6, fontSize: 14 }}>
            {shown.map((i) => <li key={i}>{i}</li>)}
          </ul>
          {more > 0 && <p className="hint">…and {more} more</p>}
          <button className="btn btn-sm btn-ghost" style={{ marginTop: 4 }} onClick={onOpen}>Open</button>
        </>
      )}
    </div>
  )
}
