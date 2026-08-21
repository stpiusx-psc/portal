import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PecMeetingNote, PecReport, PscEvent } from './types'
import { EVENTS } from '../data/events'
import { MEETINGS } from '../data/meetings'
import { TEAM } from '../data/team'

const STORAGE_KEY = 'spx-psc-portal.v1'
export const SCHOOL_YEAR = '2026-27'

/**
 * Only the fields a volunteer can edit in the portal are stored as overrides,
 * keyed by event id. Everything else keeps coming from the seed data in the
 * repo, so improving a playbook in code never wipes out somebody's edits.
 */
export type EventOverride = Partial<
  Pick<
    PscEvent,
    'date' | 'endDate' | 'dateConfidence' | 'mainResp' | 'supportResp' | 'signUpUrl' | 'budget' | 'notes' | 'status' | 'volunteerCount'
  >
> & { prepDone?: Record<string, boolean> }

interface Persisted {
  version: 1
  overrides: Record<string, EventOverride>
  reports: PecReport[]
  pecNotes: PecMeetingNote[]
}

const EMPTY: Persisted = { version: 1, overrides: {}, reports: [], pecNotes: [] }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Persisted
    return { ...EMPTY, ...parsed }
  } catch {
    return EMPTY
  }
}

function save(state: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked (private window). The app still works for the
    // current session; the user just will not get persistence.
  }
}

/** Apply stored overrides on top of the seed event. */
function merge(base: PscEvent, ov: EventOverride | undefined): PscEvent {
  if (!ov) return base
  const prep = base.prep?.map((t, i) => ({ ...t, done: ov.prepDone?.[`${i}`] ?? t.done }))
  return { ...base, ...ov, prep }
}

export interface Store {
  schoolYear: string
  events: PscEvent[]
  meetings: typeof MEETINGS
  team: typeof TEAM
  reports: PecReport[]
  pecNotes: PecMeetingNote[]
  isEdited: (id: string) => boolean
  editedCount: number
  updateEvent: (id: string, patch: EventOverride) => void
  resetEvent: (id: string) => void
  togglePrep: (eventId: string, index: number) => void
  saveReport: (r: PecReport) => void
  deleteReport: (id: string) => void
  savePecNote: (n: PecMeetingNote) => void
  deletePecNote: (id: string) => void
  exportJson: () => string
  importJson: (text: string) => { ok: true } | { ok: false; error: string }
  resetAll: () => void
}

export function useStore(): Store {
  const [state, setState] = useState<Persisted>(() => (typeof window === 'undefined' ? EMPTY : load()))

  useEffect(() => { save(state) }, [state])

  const events = useMemo(
    () => EVENTS.map((e) => merge(e, state.overrides[e.id])),
    [state.overrides],
  )

  const updateEvent = useCallback((id: string, patch: EventOverride) => {
    setState((s) => ({ ...s, overrides: { ...s.overrides, [id]: { ...s.overrides[id], ...patch } } }))
  }, [])

  const resetEvent = useCallback((id: string) => {
    setState((s) => {
      const next = { ...s.overrides }
      delete next[id]
      return { ...s, overrides: next }
    })
  }, [])

  const togglePrep = useCallback((eventId: string, index: number) => {
    setState((s) => {
      const cur = s.overrides[eventId] ?? {}
      const prepDone = { ...(cur.prepDone ?? {}) }
      const key = String(index)
      prepDone[key] = !prepDone[key]
      return { ...s, overrides: { ...s.overrides, [eventId]: { ...cur, prepDone } } }
    })
  }, [])

  const saveReport = useCallback((r: PecReport) => {
    setState((s) => ({ ...s, reports: [r, ...s.reports.filter((x) => x.id !== r.id)] }))
  }, [])

  const deleteReport = useCallback((id: string) => {
    setState((s) => ({ ...s, reports: s.reports.filter((x) => x.id !== id) }))
  }, [])

  const savePecNote = useCallback((n: PecMeetingNote) => {
    setState((s) => ({ ...s, pecNotes: [n, ...s.pecNotes.filter((x) => x.id !== n.id)] }))
  }, [])

  const deletePecNote = useCallback((id: string) => {
    setState((s) => ({ ...s, pecNotes: s.pecNotes.filter((x) => x.id !== id) }))
  }, [])

  const exportJson = useCallback(() => JSON.stringify(state, null, 2), [state])

  const importJson = useCallback((text: string): { ok: true } | { ok: false; error: string } => {
    try {
      const parsed = JSON.parse(text) as Persisted
      if (!parsed || typeof parsed !== 'object' || !('overrides' in parsed)) {
        return { ok: false, error: 'That file does not look like a portal backup.' }
      }
      setState({ ...EMPTY, ...parsed, version: 1 })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Could not read the file.' }
    }
  }, [])

  const resetAll = useCallback(() => setState(EMPTY), [])

  return {
    schoolYear: SCHOOL_YEAR,
    events,
    meetings: MEETINGS,
    team: TEAM,
    reports: state.reports,
    pecNotes: state.pecNotes,
    isEdited: (id) => Boolean(state.overrides[id]),
    editedCount: Object.keys(state.overrides).length,
    updateEvent,
    resetEvent,
    togglePrep,
    saveReport,
    deleteReport,
    savePecNote,
    deletePecNote,
    exportJson,
    importJson,
    resetAll,
  }
}
