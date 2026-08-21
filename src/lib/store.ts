import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PecMeetingNote, PecReport, PscEvent, TeamMember } from './types'
import { EVENTS } from '../data/events'
import { MEETINGS } from '../data/meetings'
import { TEAM } from '../data/team'
import { REMOTE_ENABLED, supabase } from './supabase'

const STORAGE_KEY = 'spx-psc-portal.v1'
export const SCHOOL_YEAR = '2026-27'

/**
 * Only the fields a volunteer can edit are stored as overrides, keyed by event
 * id. Everything else keeps coming from the seed data in the repo, so improving
 * a playbook in code never wipes out somebody's edited date or budget.
 */
export type EventOverride = Partial<
  Pick<
    PscEvent,
    'date' | 'endDate' | 'dateConfidence' | 'mainResp' | 'supportResp' | 'signUpUrl' | 'budget' | 'notes' | 'status' | 'volunteerCount'
  >
> & {
  prepDone?: Record<string, boolean>
  /** Who is doing each preparation task, keyed by its index in the seed list. */
  prepOwner?: Record<string, string>
}

interface Persisted {
  version: 1
  overrides: Record<string, EventOverride>
  reports: PecReport[]
  pecNotes: PecMeetingNote[]
}

const EMPTY: Persisted = { version: 1, overrides: {}, reports: [], pecNotes: [] }

/* ------------------------------------------------------------ local storage */

function loadLocal(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    return { ...EMPTY, ...(JSON.parse(raw) as Persisted) }
  } catch {
    return EMPTY
  }
}

function saveLocal(state: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked (private window). The session still works.
  }
}

/* ----------------------------------------------------- row <-> model mapping */

type OverrideRow = {
  event_id: string
  date: string | null
  end_date: string | null
  date_confidence: PscEvent['dateConfidence'] | null
  main_resp: string[] | null
  support_resp: string[] | null
  sign_up_url: string | null
  budget: number | string | null
  volunteer_count: number | null
  status: PscEvent['status'] | null
  notes: string | null
  prep_done: Record<string, boolean> | null
  prep_owner: Record<string, string> | null
}

function rowToOverride(r: OverrideRow): EventOverride {
  const ov: EventOverride = {}
  if (r.date !== null) ov.date = r.date
  if (r.end_date !== null) ov.endDate = r.end_date
  if (r.date_confidence) ov.dateConfidence = r.date_confidence
  if (r.main_resp) ov.mainResp = r.main_resp
  if (r.support_resp) ov.supportResp = r.support_resp
  if (r.sign_up_url) ov.signUpUrl = r.sign_up_url
  if (r.budget !== null) ov.budget = Number(r.budget)
  if (r.volunteer_count !== null) ov.volunteerCount = r.volunteer_count
  if (r.status) ov.status = r.status
  if (r.notes) ov.notes = r.notes
  if (r.prep_done) ov.prepDone = r.prep_done
  if (r.prep_owner) ov.prepOwner = r.prep_owner
  return ov
}

function overrideToRow(eventId: string, ov: EventOverride) {
  return {
    school_year: SCHOOL_YEAR,
    event_id: eventId,
    date: ov.date ?? null,
    end_date: ov.endDate ?? null,
    date_confidence: ov.dateConfidence ?? null,
    main_resp: ov.mainResp ?? null,
    support_resp: ov.supportResp ?? null,
    sign_up_url: ov.signUpUrl ?? null,
    budget: ov.budget ?? null,
    volunteer_count: ov.volunteerCount ?? null,
    status: ov.status ?? null,
    notes: ov.notes ?? null,
    prep_done: ov.prepDone ?? {},
    prep_owner: ov.prepOwner ?? {},
  }
}

/** Apply stored overrides on top of the seed event. */
function merge(base: PscEvent, ov: EventOverride | undefined): PscEvent {
  if (!ov) return base
  const prep = base.prep?.map((t, i) => ({
    ...t,
    done: ov.prepDone?.[`${i}`] ?? t.done,
    // An explicitly cleared owner is stored as '' and must win over the seed.
    owner: ov.prepOwner?.[`${i}`] !== undefined ? ov.prepOwner[`${i}`] || undefined : t.owner,
  }))
  return { ...base, ...ov, prep }
}

/* --------------------------------------------------------------------- store */

export type SyncState = 'local' | 'loading' | 'ready' | 'error'

export interface Store {
  schoolYear: string
  events: PscEvent[]
  meetings: typeof MEETINGS
  team: TeamMember[]
  reports: PecReport[]
  pecNotes: PecMeetingNote[]
  /** Where the data lives, and whether the last write succeeded. */
  sync: SyncState
  syncMessage: string | null
  /** True when this viewer may not change anything. */
  readOnly: boolean
  isEdited: (id: string) => boolean
  editedCount: number
  updateEvent: (id: string, patch: EventOverride) => void
  resetEvent: (id: string) => void
  togglePrep: (eventId: string, index: number) => void
  /** Assign (or clear, with an empty string) the owner of one prep task. */
  setPrepOwner: (eventId: string, index: number, owner: string) => void
  /**
   * Add or update a committee member. Pass `previousName` when renaming so the
   * person can be followed through their event assignments — the roster is
   * keyed by name, and a member added in local mode has no database id.
   */
  saveTeamMember: (m: TeamMember, previousName?: string) => Promise<string | null>
  /** Remove somebody from the roster entirely. */
  deleteTeamMember: (m: TeamMember) => Promise<string | null>
  /**
   * Put a person on, or take them off, an event — writing to the event itself
   * so the calendar and the roster can never disagree.
   */
  setAssignment: (eventId: string, person: string, as: 'lead' | 'support', on: boolean) => void
  saveReport: (r: PecReport) => void
  deleteReport: (id: string) => void
  savePecNote: (n: PecMeetingNote) => void
  deletePecNote: (id: string) => void
  exportJson: () => string
  importJson: (text: string) => { ok: true } | { ok: false; error: string }
  resetAll: () => void
}

export function useStore(opts: { remote: boolean; canEdit: boolean; email: string | null }): Store {
  const remote = REMOTE_ENABLED && opts.remote
  const [state, setState] = useState<Persisted>(() =>
    remote || typeof window === 'undefined' ? EMPTY : loadLocal(),
  )
  const [team, setTeam] = useState<TeamMember[]>(TEAM)
  const stateRef = useRef<Persisted>(EMPTY)
  const updateEventRef = useRef<(id: string, patch: EventOverride) => void>(() => {})
  const [sync, setSync] = useState<SyncState>(remote ? 'loading' : 'local')
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const loadedFor = useRef<string | null>(null)

  /* -------------------------------------------------------------- first load */
  useEffect(() => {
    if (!remote || !supabase || !opts.email) return
    if (loadedFor.current === opts.email) return
    loadedFor.current = opts.email
    let cancelled = false
    setSync('loading')

    void (async () => {
      const [ovRes, repRes, noteRes, teamRes] = await Promise.all([
        supabase.from('psc_event_overrides').select('*').eq('school_year', SCHOOL_YEAR),
        supabase.from('psc_pec_reports').select('*').eq('school_year', SCHOOL_YEAR).order('created_at', { ascending: false }),
        supabase.from('psc_pec_notes').select('*').eq('school_year', SCHOOL_YEAR).order('meeting_date', { ascending: false }),
        supabase.from('psc_team').select('*').order('sort_order').order('name'),
      ])
      if (cancelled) return

      const err = ovRes.error ?? repRes.error ?? noteRes.error ?? teamRes.error
      if (err) {
        setSync('error')
        setSyncMessage(`Could not load the shared data: ${err.message}`)
        return
      }

      const overrides: Record<string, EventOverride> = {}
      for (const r of (ovRes.data ?? []) as OverrideRow[]) overrides[r.event_id] = rowToOverride(r)

      const reports: PecReport[] = ((repRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        sourceMeetingDate: (r.source_meeting_date as string) ?? '',
        pecMeetingDate: (r.pec_meeting_date as string) ?? undefined,
        title: String(r.title),
        createdAt: String(r.created_at),
        highlights: (r.highlights as string[]) ?? [],
        decisions: (r.decisions as string[]) ?? [],
        financials: (r.financials as string[]) ?? [],
        asksForPec: (r.asks_for_pec as string[]) ?? [],
        upcoming: (r.upcoming as string[]) ?? [],
        sourceText: (r.source_text as string) ?? undefined,
      }))

      const pecNotes: PecMeetingNote[] = ((noteRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        meetingDate: String(r.meeting_date),
        attendees: (r.attendees as string) ?? undefined,
        points: (r.points as string[]) ?? [],
        feedbackOnMinutes: (r.feedback_on_minutes as string[]) ?? [],
        actions: (r.actions as string[]) ?? [],
        createdAt: String(r.created_at),
        sentAt: (r.sent_at as string) ?? undefined,
      }))

      setTeam(((teamRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: Number(r.id),
        name: String(r.name),
        role: String(r.title ?? 'Committee'),
        active: r.active !== false,
        involvement: r.note ? String(r.note).split(',').map((x) => x.trim()).filter(Boolean) : [],
        sortOrder: Number(r.sort_order ?? 1000),
      })))

      setState({ version: 1, overrides, reports, pecNotes })
      setSync('ready')
      setSyncMessage(null)
    })()

    return () => { cancelled = true }
  }, [remote, opts.email])

  /* ----------------------------------------------------- local-only persistence */
  useEffect(() => {
    stateRef.current = state
    if (!remote) saveLocal(state)
  }, [state, remote])

  const fail = useCallback((what: string, message: string) => {
    setSync('error')
    setSyncMessage(`${what} could not be saved to the server: ${message}. Your change is visible here but other people will not see it — reload to check.`)
  }, [])

  const ok = useCallback(() => {
    setSync((s) => (s === 'error' ? 'ready' : s))
    setSyncMessage(null)
  }, [])

  /* ------------------------------------------------------------------ writes */

  const pushOverride = useCallback((id: string, next: EventOverride) => {
    if (!remote || !supabase) return
    void supabase
      .from('psc_event_overrides')
      .upsert(overrideToRow(id, next), { onConflict: 'school_year,event_id' })
      .then(({ error }) => (error ? fail('That event', error.message) : ok()))
  }, [remote, fail, ok])

  const updateEvent = useCallback((id: string, patch: EventOverride) => {
    if (opts.canEdit === false) return
    setState((s) => {
      const next = { ...s.overrides[id], ...patch }
      pushOverride(id, next)
      return { ...s, overrides: { ...s.overrides, [id]: next } }
    })
  }, [opts.canEdit, pushOverride])

  const resetEvent = useCallback((id: string) => {
    if (!opts.canEdit) return
    setState((s) => {
      const next = { ...s.overrides }
      delete next[id]
      return { ...s, overrides: next }
    })
    if (remote && supabase) {
      void supabase
        .from('psc_event_overrides')
        .delete()
        .eq('school_year', SCHOOL_YEAR)
        .eq('event_id', id)
        .then(({ error }) => (error ? fail('That reset', error.message) : ok()))
    }
  }, [opts.canEdit, remote, fail, ok])

  const togglePrep = useCallback((eventId: string, index: number) => {
    if (!opts.canEdit) return
    setState((s) => {
      const cur = s.overrides[eventId] ?? {}
      const prepDone = { ...(cur.prepDone ?? {}) }
      const key = String(index)
      prepDone[key] = !prepDone[key]
      const next = { ...cur, prepDone }
      pushOverride(eventId, next)
      return { ...s, overrides: { ...s.overrides, [eventId]: next } }
    })
  }, [opts.canEdit, pushOverride])

  // Kept in a ref so the team helpers can reassign events without depending on
  // updateEvent directly, which would make the callbacks re-create each other.
  useEffect(() => { updateEventRef.current = updateEvent }, [updateEvent])

  const setPrepOwner = useCallback((eventId: string, index: number, owner: string) => {
    if (!opts.canEdit) return
    setState((s) => {
      const cur = s.overrides[eventId] ?? {}
      const prepOwner = { ...(cur.prepOwner ?? {}), [String(index)]: owner }
      const next = { ...cur, prepOwner }
      pushOverride(eventId, next)
      return { ...s, overrides: { ...s.overrides, [eventId]: next } }
    })
  }, [opts.canEdit, pushOverride])

  const saveReport = useCallback((r: PecReport) => {
    if (!opts.canEdit) return
    setState((s) => ({ ...s, reports: [r, ...s.reports.filter((x) => x.id !== r.id)] }))
    if (remote && supabase) {
      void supabase.from('psc_pec_reports').upsert({
        id: r.id,
        school_year: SCHOOL_YEAR,
        source_meeting_date: r.sourceMeetingDate || null,
        pec_meeting_date: r.pecMeetingDate || null,
        title: r.title,
        highlights: r.highlights,
        decisions: r.decisions,
        financials: r.financials,
        asks_for_pec: r.asksForPec,
        upcoming: r.upcoming,
        source_text: r.sourceText ?? null,
        created_by: opts.email,
      }).then(({ error }) => (error ? fail('That report', error.message) : ok()))
    }
  }, [opts.canEdit, opts.email, remote, fail, ok])

  const deleteReport = useCallback((id: string) => {
    if (!opts.canEdit) return
    setState((s) => ({ ...s, reports: s.reports.filter((x) => x.id !== id) }))
    if (remote && supabase) {
      void supabase.from('psc_pec_reports').delete().eq('id', id)
        .then(({ error }) => (error ? fail('That deletion', error.message) : ok()))
    }
  }, [opts.canEdit, remote, fail, ok])

  const savePecNote = useCallback((n: PecMeetingNote) => {
    if (!opts.canEdit) return
    setState((s) => ({ ...s, pecNotes: [n, ...s.pecNotes.filter((x) => x.id !== n.id)] }))
    if (remote && supabase) {
      void supabase.from('psc_pec_notes').upsert({
        id: n.id,
        school_year: SCHOOL_YEAR,
        meeting_date: n.meetingDate,
        attendees: n.attendees ?? null,
        points: n.points,
        feedback_on_minutes: n.feedbackOnMinutes,
        actions: n.actions,
        created_by: opts.email,
      }).then(({ error }) => (error ? fail('Those notes', error.message) : ok()))
    }
  }, [opts.canEdit, opts.email, remote, fail, ok])

  const deletePecNote = useCallback((id: string) => {
    if (!opts.canEdit) return
    setState((s) => ({ ...s, pecNotes: s.pecNotes.filter((x) => x.id !== id) }))
    if (remote && supabase) {
      void supabase.from('psc_pec_notes').delete().eq('id', id)
        .then(({ error }) => (error ? fail('That deletion', error.message) : ok()))
    }
  }, [opts.canEdit, remote, fail, ok])



  /** Current lead/support lists for an event, seed merged with any override. */
  const rosterOf = useCallback((eventId: string, as: 'lead' | 'support'): string[] => {
    const base = EVENTS.find((e) => e.id === eventId)
    const ov = stateRef.current.overrides[eventId]
    const key = as === 'lead' ? 'mainResp' : 'supportResp'
    const fromOverride = ov?.[key]
    if (fromOverride) return fromOverride
    return (as === 'lead' ? base?.mainResp : base?.supportResp) ?? []
  }, [])

  const setAssignment = useCallback((eventId: string, person: string, as: 'lead' | 'support', on: boolean) => {
    if (!opts.canEdit) return
    const key = as === 'lead' ? 'mainResp' : 'supportResp'
    const current = rosterOf(eventId, as)
    const has = current.some((p) => p.toLowerCase() === person.toLowerCase())
    if (on === has) return
    const next = on
      ? [...current, person]
      : current.filter((p) => p.toLowerCase() !== person.toLowerCase())
    updateEventRef.current(eventId, { [key]: next } as EventOverride)
  }, [opts.canEdit, rosterOf])

  /** Follow a renamed person through every event they are credited on. */
  const renameInAssignments = useCallback((from: string, to: string) => {
    for (const e of EVENTS) {
      for (const as of ['lead', 'support'] as const) {
        const key = as === 'lead' ? 'mainResp' : 'supportResp'
        const list = rosterOf(e.id, as)
        if (!list.some((p) => p.toLowerCase() === from.toLowerCase())) continue
        const next = list.map((p) => (p.toLowerCase() === from.toLowerCase() ? to : p))
        updateEventRef.current(e.id, { [key]: next } as EventOverride)
      }
    }
  }, [rosterOf])

  /* ------------------------------------------------------------------- team */

  const saveTeamMember = useCallback(async (m: TeamMember, previousName?: string): Promise<string | null> => {
    if (!opts.canEdit) return 'You have read-only access.'
    const name = m.name.trim()
    if (!name) return 'A name is required.'

    // Identify the row being edited by id when we have one, otherwise by the
    // name it had before this edit. A brand-new member matches nothing, which
    // is what makes the duplicate check below fire.
    const wasCalled = previousName?.trim()
    const isSame = (t: TeamMember) =>
      m.id != null
        ? t.id === m.id
        : wasCalled != null && t.name.toLowerCase() === wasCalled.toLowerCase()

    const clash = team.find((t) => t.name.toLowerCase() === name.toLowerCase() && !isSame(t))
    if (clash) return `${name} is already on the roster.`

    const renamedFrom = wasCalled && wasCalled.toLowerCase() !== name.toLowerCase() ? wasCalled : null

    const next: TeamMember = { ...m, name }
    setTeam((cur) => {
      const without = cur.filter((t) => !isSame(t))
      return [...without, next].sort(
        (a, b) => (a.sortOrder ?? 1000) - (b.sortOrder ?? 1000) || a.name.localeCompare(b.name),
      )
    })

    // A rename has to follow the person through their event assignments,
    // otherwise the calendar keeps crediting a name that no longer exists.
    if (renamedFrom) renameInAssignments(renamedFrom, name)

    if (remote && supabase) {
      const row = {
        name,
        title: m.role || 'Committee',
        active: m.active !== false,
        sort_order: m.sortOrder ?? 1000,
        note: m.involvement.length ? m.involvement.join(', ') : null,
      }
      const { data, error } = m.id
        ? await supabase.from('psc_team').update(row).eq('id', m.id).select('id').maybeSingle()
        : await supabase.from('psc_team')
            .upsert(row, { onConflict: 'name' })
            .select('id').maybeSingle()
      if (error) { fail('That committee member', error.message); return error.message }
      if (!m.id && data) setTeam((cur) => cur.map((t) => (t.name === name ? { ...t, id: Number(data.id) } : t)))
      ok()
    }
    return null
  }, [opts.canEdit, team, remote, fail, ok, renameInAssignments])

  const deleteTeamMember = useCallback(async (m: TeamMember): Promise<string | null> => {
    if (!opts.canEdit) return 'You have read-only access.'
    setTeam((cur) => cur.filter((t) => (m.id ? t.id !== m.id : t.name !== m.name)))
    if (remote && supabase && m.id) {
      const { error } = await supabase.from('psc_team').delete().eq('id', m.id)
      if (error) { fail('That removal', error.message); return error.message }
      ok()
    }
    return null
  }, [opts.canEdit, remote, fail, ok])

  /* ------------------------------------------------------------ backup files */

  const exportJson = useCallback(() => JSON.stringify(state, null, 2), [state])

  const importJson = useCallback((text: string): { ok: true } | { ok: false; error: string } => {
    if (!opts.canEdit) return { ok: false, error: 'You have read-only access.' }
    try {
      const parsed = JSON.parse(text) as Persisted
      if (!parsed || typeof parsed !== 'object' || !('overrides' in parsed)) {
        return { ok: false, error: 'That file does not look like a portal backup.' }
      }
      setState({ ...EMPTY, ...parsed, version: 1 })
      if (remote && supabase) {
        const rows = Object.entries(parsed.overrides ?? {}).map(([id, ov]) => overrideToRow(id, ov))
        if (rows.length) {
          void supabase.from('psc_event_overrides')
            .upsert(rows, { onConflict: 'school_year,event_id' })
            .then(({ error }) => (error ? fail('The restored calendar', error.message) : ok()))
        }
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Could not read the file.' }
    }
  }, [opts.canEdit, remote, fail, ok])

  const resetAll = useCallback(() => {
    if (!opts.canEdit) return
    const ids = Object.keys(state.overrides)
    setState(EMPTY)
    if (remote && supabase) {
      void (async () => {
        const results = await Promise.all([
          ids.length
            ? supabase.from('psc_event_overrides').delete().eq('school_year', SCHOOL_YEAR).in('event_id', ids)
            : Promise.resolve({ error: null }),
          supabase.from('psc_pec_reports').delete().eq('school_year', SCHOOL_YEAR),
          supabase.from('psc_pec_notes').delete().eq('school_year', SCHOOL_YEAR),
        ])
        const err = results.find((r) => r.error)?.error
        if (err) fail('The reset', err.message)
        else ok()
      })()
    }
  }, [opts.canEdit, remote, state.overrides, fail, ok])

  const events = useMemo(
    () => EVENTS.map((e) => merge(e, state.overrides[e.id])),
    [state.overrides],
  )

  return {
    schoolYear: SCHOOL_YEAR,
    events,
    meetings: MEETINGS,
    team,
    reports: state.reports,
    pecNotes: state.pecNotes,
    sync,
    syncMessage,
    readOnly: !opts.canEdit,
    isEdited: (id) => Boolean(state.overrides[id]),
    editedCount: Object.keys(state.overrides).length,
    updateEvent,
    resetEvent,
    togglePrep,
    setPrepOwner,
    saveTeamMember,
    deleteTeamMember,
    setAssignment,
    saveReport,
    deleteReport,
    savePecNote,
    deletePecNote,
    exportJson,
    importJson,
    resetAll,
  }
}
