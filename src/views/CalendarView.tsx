import { useMemo, useState } from 'react'
import type { Store } from '../lib/store'
import type { PscEvent } from '../lib/types'
import { navigate } from '../App'
import { Banner, Chip, ConfidenceChip, PrintHead, money, whenLabel } from '../components/ui'
import {
  DAY_SHORT, buckets, formatMonthKey, formatShort, monthGrid, monthKeyOf,
  schoolYearMonths, todayISO, type Grain,
} from '../lib/dates'
import { downloadCsv, downloadIcs, downloadText, eventsToCsv, eventsToText, printView } from '../lib/exporters'
import { EventEditor } from '../components/EventEditor'

type Detail = 'summary' | 'standard' | 'full'
type Layout = 'grid' | 'list'

export function CalendarView({ store }: { store: Store }) {
  const [grain, setGrain] = useState<Grain>('year')
  const [bucketIdx, setBucketIdx] = useState(0)
  const [bucketTouched, setBucketTouched] = useState(false)
  const [detail, setDetail] = useState<Detail>('standard')
  const [layout, setLayout] = useState<Layout>('grid')
  const [category, setCategory] = useState<string>('all')
  const [editing, setEditing] = useState<PscEvent | null>(null)
  const today = todayISO()

  const allBuckets = useMemo(() => buckets(store.schoolYear, grain), [store.schoolYear, grain])

  /**
   * When the range changes, land on a period that is actually useful: the one
   * containing today if it has activities, otherwise the next one that does.
   */
  const defaultIdx = useMemo(() => {
    const thisMonth = monthKeyOf(today)
    const has = (months: string[]) =>
      store.events.some((e) => {
        if (e.status === 'discontinued') return false
        const key = e.date ? monthKeyOf(e.date) : e.monthHint
        return key ? months.includes(key) : false
      })
    const here = allBuckets.findIndex((b) => b.months.includes(thisMonth))
    if (here >= 0 && has(allBuckets[here].months)) return here
    const from = here >= 0 ? here : 0
    for (let i = from; i < allBuckets.length; i++) if (has(allBuckets[i].months)) return i
    return Math.max(here, 0)
  }, [allBuckets, store.events, today])

  const activeIdx = bucketTouched ? Math.min(bucketIdx, allBuckets.length - 1) : defaultIdx
  const current = allBuckets[activeIdx]

  const visible = useMemo(() => {
    return store.events.filter((e) => {
      if (e.status === 'discontinued') return false
      if (category !== 'all' && e.category !== category) return false
      return true
    })
  }, [store.events, category])

  /** Events that fall inside the selected months, keyed by month. */
  const byMonth = useMemo(() => {
    const map = new Map<string, PscEvent[]>()
    for (const m of current.months) map.set(m, [])
    for (const e of visible) {
      const key = e.date ? monthKeyOf(e.date) : e.monthHint
      if (!key || !map.has(key)) continue
      map.get(key)!.push(e)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.name.localeCompare(b.name))
    }
    return map
  }, [visible, current.months])

  const inRange = useMemo(() => current.months.flatMap((m) => byMonth.get(m) ?? []), [byMonth, current.months])
  const rangeTitle = `PSC Calendar · ${current.label}`

  const undated = inRange.filter((e) => !e.date)
  const unconfirmed = inRange.filter((e) => e.dateConfidence !== 'confirmed').length

  return (
    <>
      <header className="topbar no-print">
        <div>
          <h1>Year Calendar</h1>
          <p>
            Every PSC activity for {store.schoolYear}. Click any event to set the date, the main responsible,
            the sign-up link and the budget. Export any range as a PDF, a spreadsheet or a calendar file.
          </p>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={() => downloadIcs(`spx-psc-${store.schoolYear}.ics`, inRange, rangeTitle)}>
            ⤓ Calendar (.ics)
          </button>
          <button className="btn" onClick={() => downloadCsv(`spx-psc-${store.schoolYear}.csv`, eventsToCsv(inRange))}>
            ⤓ Spreadsheet
          </button>
          <button className="btn" onClick={() => downloadText(`spx-psc-${current.label}.txt`, eventsToText(inRange, rangeTitle, detail))}>
            ⤓ Text
          </button>
          <button className="btn btn-primary" onClick={printView}>⎙ Print / PDF</button>
        </div>
      </header>

      <div className="content">
        <PrintHead title={rangeTitle} subtitle={`${inRange.length} activities · detail level: ${detail}`} />

        <div className="toolbar no-print">
          <label className="field">
            <span>Range</span>
            <select
              value={grain}
              onChange={(e) => { setGrain(e.target.value as Grain); setBucketTouched(false) }}
            >
              <option value="month">Month</option>
              <option value="bimester">Two months</option>
              <option value="semester">Term (5 months)</option>
              <option value="year">Full year</option>
            </select>
          </label>

          {allBuckets.length > 1 && (
            <label className="field grow">
              <span>Period</span>
              <select value={activeIdx} onChange={(e) => { setBucketIdx(Number(e.target.value)); setBucketTouched(true) }}>
                {allBuckets.map((b, i) => (
                  <option key={b.label} value={i}>
                    {b.label} ({b.months.reduce((s, m) => s + (byMonth.get(m)?.length ?? 0), 0) || countIn(visible, b.months)} activities)
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field">
            <span>Detail</span>
            <select value={detail} onChange={(e) => setDetail(e.target.value as Detail)}>
              <option value="summary">Summary — dates and names only</option>
              <option value="standard">Standard — plus owner and budget</option>
              <option value="full">Full — plus prior-year actuals and lessons</option>
            </select>
          </label>

          <label className="field">
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              <option value="fundraiser">Fundraiser</option>
              <option value="community">Community</option>
              <option value="faith">Faith</option>
              <option value="school-support">School support</option>
              <option value="ongoing">Ongoing</option>
              <option value="governance">Governance</option>
            </select>
          </label>

          <label className="field">
            <span>Layout</span>
            <select value={layout} onChange={(e) => setLayout(e.target.value as Layout)}>
              <option value="grid">Month grid</option>
              <option value="list">Agenda list</option>
            </select>
          </label>
        </div>

        {unconfirmed > 0 && (
          <Banner tone="warn">
            <span>
              <strong>{unconfirmed} dates in this range are not confirmed.</strong>{' '}
              They were rolled forward from 2025-26. Confirm each one with Ms. Francis, then mark it confirmed so the
              exports can safely go to parents.
            </span>
          </Banner>
        )}

        <div className="grid" style={{ gridTemplateColumns: layout === 'grid' && current.months.length > 1 ? 'repeat(auto-fit, minmax(330px, 1fr))' : '1fr' }}>
          {current.months.map((m) => {
            const events = byMonth.get(m) ?? []
            return (
              <div className="cal-month" key={m}>
                <h3>
                  {formatMonthKey(m)}
                  <span className="cnt">{events.length ? `${events.length} activit${events.length === 1 ? 'y' : 'ies'}` : 'nothing scheduled'}</span>
                </h3>

                {layout === 'grid' && (
                  <div className="cal-grid" role="presentation">
                    {DAY_SHORT.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
                    {monthGrid(m).flat().map((iso, i) => (
                      <div key={i} className={`cal-cell${iso ? '' : ' empty'}${iso === today ? ' today' : ''}`}>
                        {iso && <div className="d">{Number(iso.slice(8))}</div>}
                        {iso && events.filter((e) => spans(e, iso)).map((e) => (
                          <button
                            key={e.id}
                            className={`cal-ev cat-${e.category}${e.dateConfidence === 'confirmed' ? '' : ' proposed'}`}
                            onClick={() => setEditing(e)}
                            title={`${e.name} — ${whenLabel(e)}`}
                          >
                            {e.name}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {events.length === 0 ? (
                  <div className="month-empty">No activities recorded for this month.</div>
                ) : (
                  <div className="month-list">
                    {events.map((e) => (
                      <div className="month-row" key={e.id}>
                        <div className="when">{e.date ? formatShort(e.date) : 'TBD'}</div>
                        <div className="what">
                          <button className="linkish" onClick={() => setEditing(e)}>{e.name}</button>
                          {detail !== 'summary' && (
                            <div className="chips" style={{ marginTop: 4 }}>
                              <Chip category={e.category}>{e.mainResp.length ? e.mainResp.join(', ') : 'No owner'}</Chip>
                              <ConfidenceChip c={e.dateConfidence} />
                              {e.budget != null && <Chip tone="plain">Budget {money(e.budget)}</Chip>}
                              {e.needsVolunteers && (
                                e.signUpUrl
                                  ? <Chip tone="ok">Sign-up ready</Chip>
                                  : <Chip tone="warn">Sign-up needed</Chip>
                              )}
                            </div>
                          )}
                          {detail === 'full' && (
                            <div style={{ marginTop: 5, fontSize: 13, color: 'var(--ink-muted)' }}>
                              {e.summary}
                              {e.actuals?.length ? (
                                <div style={{ marginTop: 3 }}>
                                  {e.actuals.map((a) => (
                                    <div key={a.year}>
                                      {a.year} actual: {money(a.revenue)} revenue · {money(a.costs)} costs · <strong>{money(a.net)} net</strong>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                        <div className="who no-print">
                          <button className="btn btn-sm btn-ghost" onClick={() => navigate({ view: 'events', id: e.id })}>Playbook →</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {undated.length > 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <div className="card-head"><h2>Month known, date still to set ({undated.length})</h2></div>
            <div className="month-list">
              {undated.map((e) => (
                <div className="month-row" key={e.id}>
                  <div className="when">{e.monthHint ? formatMonthKey(e.monthHint) : 'TBD'}</div>
                  <div className="what"><button className="linkish" onClick={() => setEditing(e)}>{e.name}</button></div>
                  <div className="who">{e.mainResp.length ? e.mainResp.join(', ') : 'No owner'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EventEditor
          event={editing}
          store={store}
          onClose={() => setEditing(null)}
          onOpenPlaybook={(id) => { setEditing(null); navigate({ view: 'events', id }) }}
        />
      )}
    </>
  )
}

function countIn(events: PscEvent[], months: string[]): number {
  return events.filter((e) => {
    const key = e.date ? monthKeyOf(e.date) : e.monthHint
    return key ? months.includes(key) : false
  }).length
}

/** Does an event occupy this calendar day (handles multi-day ranges)? */
function spans(e: PscEvent, iso: string): boolean {
  if (!e.date) return false
  if (!e.endDate) return e.date === iso
  return iso >= e.date && iso <= e.endDate
}

export function schoolYearMonthKeys(year: string) { return schoolYearMonths(year) }
