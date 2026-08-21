import { useEffect, useState } from 'react'
import type { Store } from '../lib/store'
import type { DateConfidence, PscEvent } from '../lib/types'
import { Chip, money } from './ui'

/**
 * The one place a volunteer changes a live event: date, who owns it, the
 * SignUpGenius link and the money. Everything else on an event (the playbook,
 * the lessons learned) is reference material and lives in the repo.
 */
export function EventEditor({
  event, store, onClose, onOpenPlaybook,
}: {
  event: PscEvent
  store: Store
  onClose: () => void
  onOpenPlaybook?: (id: string) => void
}) {
  const [date, setDate] = useState(event.date ?? '')
  const [endDate, setEndDate] = useState(event.endDate ?? '')
  const [confidence, setConfidence] = useState<DateConfidence>(event.dateConfidence)
  const [mainResp, setMainResp] = useState(event.mainResp.join(', '))
  const [supportResp, setSupportResp] = useState((event.supportResp ?? []).join(', '))
  const [signUpUrl, setSignUpUrl] = useState(event.signUpUrl ?? '')
  const [budget, setBudget] = useState(event.budget != null ? String(event.budget) : '')
  const [slots, setSlots] = useState(event.volunteerCount != null ? String(event.volunteerCount) : '')
  const [notes, setNotes] = useState(event.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    if (endDate && date && endDate < date) {
      setError('The end date cannot be before the start date.')
      return
    }
    const budgetNum = budget.trim() === '' ? undefined : Number(budget)
    if (budgetNum != null && (!Number.isFinite(budgetNum) || budgetNum < 0)) {
      setError('Budget must be a positive number.')
      return
    }
    const slotsNum = slots.trim() === '' ? undefined : Number(slots)
    if (slotsNum != null && (!Number.isFinite(slotsNum) || slotsNum < 0)) {
      setError('Volunteer slots must be a positive number.')
      return
    }
    if (signUpUrl.trim() && !/^https?:\/\//i.test(signUpUrl.trim())) {
      setError('The sign-up link needs to start with http:// or https://')
      return
    }
    const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
    store.updateEvent(event.id, {
      date: date || null,
      endDate: endDate || null,
      dateConfidence: confidence,
      mainResp: split(mainResp),
      supportResp: split(supportResp),
      signUpUrl: signUpUrl.trim() || undefined,
      budget: budgetNum,
      volunteerCount: slotsNum,
      notes: notes.trim() || undefined,
    })
    onClose()
  }

  const lastYear = event.actuals?.[0]

  return (
    <div className="modal-backdrop no-print" role="dialog" aria-modal="true" aria-label={`Edit ${event.name}`} onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{event.name}</h2>
            <div className="chips" style={{ marginTop: 6 }}>
              <Chip category={event.category}>{event.category}</Chip>
              {event.majorEvent && <Chip tone="warn">Major event</Chip>}
              {store.isEdited(event.id) && <Chip tone="ok">Edited</Chip>}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {event.priorYearDate && (
            <div className="callout info" style={{ marginBottom: 14 }}>
              <strong>Last year:</strong> {event.priorYearDate}.
              {confidence === 'proposed' && ' The date below was rolled forward from that — confirm it with Ms. Francis, then set it to Confirmed.'}
            </div>
          )}

          <div className="grid grid-2">
            <label className="field">
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <span className="hint">Leave empty if the date is genuinely not known yet.</span>
            </label>
            <label className="field">
              <span>End date (multi-day events only)</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>

          <label className="field">
            <span>Date status</span>
            <select value={confidence} onChange={(e) => setConfidence(e.target.value as DateConfidence)}>
              <option value="proposed">Proposed — rolled forward, not yet agreed</option>
              <option value="confirmed">Confirmed — agreed with the school / parish</option>
              <option value="tbd">To be decided — no date yet</option>
            </select>
          </label>

          <label className="field">
            <span>Main responsible</span>
            <input type="text" value={mainResp} onChange={(e) => setMainResp(e.target.value)} placeholder="e.g. Lynda Freeman, Stephanie Toves" />
            <span className="hint">Separate several people with commas.</span>
          </label>

          <label className="field">
            <span>Support team</span>
            <input type="text" value={supportResp} onChange={(e) => setSupportResp(e.target.value)} placeholder="Committee members helping out" />
          </label>

          <div className="grid grid-2">
            <label className="field">
              <span>Assigned budget (CAD)</span>
              <input type="number" min="0" step="10" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 1200" />
              {lastYear && (
                <span className="hint">
                  {lastYear.year} actual: {money(lastYear.revenue)} revenue, {money(lastYear.costs)} costs, {money(lastYear.net)} net.
                </span>
              )}
            </label>
            <label className="field">
              <span>Volunteer slots needed</span>
              <input type="number" min="0" step="1" value={slots} onChange={(e) => setSlots(e.target.value)} placeholder="e.g. 50" />
            </label>
          </div>

          <label className="field">
            <span>SignUpGenius (or other sign-up) link</span>
            <input type="url" value={signUpUrl} onChange={(e) => setSignUpUrl(e.target.value)} placeholder="https://www.signupgenius.com/..." />
            <span className="hint">Paste the link once and it shows up on the calendar, the playbook and every export.</span>
          </label>

          <label className="field">
            <span>Notes for this year</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the committee should know for this year's run." />
          </label>

          {store.readOnly && (
            <div className="callout warn">
              You have read-only access, so these fields cannot be saved.
            </div>
          )}
          {error && <div className="callout warn">{error}</div>}
        </div>

        <div className="modal-foot">
          {onOpenPlaybook && (
            <button className="btn btn-ghost" onClick={() => onOpenPlaybook(event.id)}>Open full playbook →</button>
          )}
          <span style={{ marginLeft: 'auto' }} />
          {store.isEdited(event.id) && !store.readOnly && (
            <button className="btn btn-danger" onClick={() => { store.resetEvent(event.id); onClose() }}>
              Reset to original
            </button>
          )}
          <button className="btn" onClick={onClose}>{store.readOnly ? 'Close' : 'Cancel'}</button>
          {!store.readOnly && <button className="btn btn-primary" onClick={save}>Save</button>}
        </div>
      </div>
    </div>
  )
}
