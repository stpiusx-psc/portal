import { useMemo, useState } from 'react'
import type { Store } from '../lib/store'
import type { PecMeetingNote } from '../lib/types'
import { Banner, Chip, Empty, PrintHead } from '../components/ui'
import { formatLong, todayISO } from '../lib/dates'
import { downloadText, printView } from '../lib/exporters'

/** Where the feedback email goes. Ms. Francis gets added later. */
const CHAIR_EMAIL = 'lyndadfreeman@gmail.com'
const PRINCIPAL_EMAIL = 'cfrancis@saintpius.ca'

type Bucket = 'points' | 'feedbackOnMinutes' | 'actions'

const BUCKETS: { key: Bucket; label: string; help: string; placeholder: string }[] = [
  {
    key: 'points',
    label: 'Raised at the PEC',
    help: 'What the PEC discussed that the PSC needs to know.',
    placeholder: 'e.g. PEC asked whether the school can share the family list for volunteer tracking',
  },
  {
    key: 'feedbackOnMinutes',
    label: 'Feedback on the PSC minutes',
    help: 'Comments, corrections or questions on what Lynda circulated.',
    placeholder: 'e.g. Hot lunch vendor change should be flagged to parents before ordering opens',
  },
  {
    key: 'actions',
    label: 'What I committed to',
    help: 'Follow-ups you owe the PEC or the PSC.',
    placeholder: 'e.g. Confirm the Craft Fair date with Ms. Francis and report back',
  },
]

export function PecMeetingView({ store }: { store: Store }) {
  const [meetingDate, setMeetingDate] = useState(todayISO())
  const [attendees, setAttendees] = useState('')
  const [buckets, setBuckets] = useState<Record<Bucket, string[]>>({ points: [''], feedbackOnMinutes: [''], actions: [''] })
  const [includePrincipal, setIncludePrincipal] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean)
  const filled = useMemo(
    () => BUCKETS.reduce((s, b) => s + clean(buckets[b.key]).length, 0),
    [buckets],
  )

  const setLine = (b: Bucket, i: number, v: string) =>
    setBuckets((s) => {
      const next = [...s[b]]
      next[i] = v
      // Always keep one empty line at the end so typing flows.
      if (i === next.length - 1 && v.trim() !== '') next.push('')
      return { ...s, [b]: next }
    })

  const removeLine = (b: Bucket, i: number) =>
    setBuckets((s) => {
      const next = s[b].filter((_, n) => n !== i)
      return { ...s, [b]: next.length ? next : [''] }
    })

  const emailBody = useMemo(() => {
    const block = (title: string, items: string[]) =>
      items.length ? `${title}\n${items.map((i) => `  - ${i}`).join('\n')}\n` : ''
    const sections = [
      block('Raised at the PEC', clean(buckets.points)),
      block('Feedback on the PSC minutes', clean(buckets.feedbackOnMinutes)),
      block('What I will follow up on', clean(buckets.actions)),
    ].filter(Boolean)
    return [
      `Hi Lynda,`,
      ``,
      `Thanks for sending through the PSC minutes. Here is a summary of the PEC meeting held on ${formatLong(meetingDate)}, plus my feedback.`,
      ``,
      ...sections,
      `Happy to talk any of this through before the next PSC meeting.`,
      ``,
      `Best regards,`,
      `Jorge Chinchilla`,
      `PEC Liaison — St. Pius X Parent Standing Committee`,
    ].join('\n')
  }, [meetingDate, buckets])

  const subject = `PEC meeting ${formatLong(meetingDate)} — summary and feedback on the PSC minutes`

  const mailto = useMemo(() => {
    const to = includePrincipal ? `${CHAIR_EMAIL},${PRINCIPAL_EMAIL}` : CHAIR_EMAIL
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`
  }, [emailBody, subject, includePrincipal])

  const save = () => {
    const note: PecMeetingNote = {
      id: `pec-${meetingDate}-${Date.now()}`,
      meetingDate,
      attendees: attendees.trim() || undefined,
      points: clean(buckets.points),
      feedbackOnMinutes: clean(buckets.feedbackOnMinutes),
      actions: clean(buckets.actions),
      createdAt: new Date().toISOString(),
    }
    store.savePecNote(note)
    setStatus('Notes saved to this portal.')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${emailBody}`)
      setStatus('Email copied to the clipboard — paste it into Gmail.')
    } catch {
      setStatus('Could not reach the clipboard — use Download instead.')
    }
  }

  return (
    <>
      <header className="topbar no-print">
        <div>
          <h1>PEC Meeting Notes</h1>
          <p>
            Open this during the PEC meeting and type as you go. When the meeting ends, it turns your notes into
            an email to Lynda with your feedback on her minutes.
          </p>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={copy} disabled={filled === 0}>⧉ Copy email</button>
          <button className="btn" onClick={() => downloadText(`pec-notes-${meetingDate}.txt`, emailBody)} disabled={filled === 0}>⤓ Download</button>
          <button className="btn" onClick={printView} disabled={filled === 0}>⎙ Print / PDF</button>
          <a className="btn btn-primary" href={filled === 0 ? undefined : mailto} aria-disabled={filled === 0}>✉ Open in email</a>
        </div>
      </header>

      <div className="content">
        {status && <Banner tone="info">{status}</Banner>}
        <Banner tone="warn">
          <span>
            <strong>Nothing is sent automatically.</strong> “Open in email” opens a pre-filled draft in your own mail
            app so you read it before it goes. Recipient: {CHAIR_EMAIL}
            {includePrincipal && ` and ${PRINCIPAL_EMAIL}`}.
          </span>
        </Banner>

        <PrintHead title={`PEC Meeting Notes — ${formatLong(meetingDate)}`} />

        <div className="split">
          <div>
            <div className="card">
              <div className="card-head">
                <h2>Meeting</h2>
                <span className="spacer" />
                <Chip tone={filled > 0 ? 'ok' : 'plain'}>{filled} point{filled === 1 ? '' : 's'}</Chip>
              </div>
              <div className="card-pad">
                <div className="grid grid-2">
                  <label className="field">
                    <span>PEC meeting date</span>
                    <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Who was there (optional)</span>
                    <input type="text" value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="Names or just a count" />
                  </label>
                </div>
              </div>
            </div>

            {BUCKETS.map((b) => (
              <div className="card" key={b.key}>
                <div className="card-head">
                  <h2>{b.label}</h2>
                  <span className="spacer" />
                  <Chip tone="plain">{clean(buckets[b.key]).length}</Chip>
                </div>
                <div className="card-pad">
                  <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>{b.help}</p>
                  {buckets[b.key].map((line, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <textarea
                        rows={1}
                        value={line}
                        placeholder={i === 0 ? b.placeholder : 'Another point…'}
                        onChange={(e) => setLine(b.key, i, e.target.value)}
                        aria-label={`${b.label} ${i + 1}`}
                      />
                      {buckets[b.key].length > 1 && (
                        <button className="btn btn-sm btn-ghost" onClick={() => removeLine(b.key, i)} title="Remove">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="card">
              <div className="card-head">
                <h2>Email to Lynda</h2>
                <span className="spacer" />
                <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', color: 'var(--ink-muted)' }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={includePrincipal}
                    onChange={(e) => setIncludePrincipal(e.target.checked)}
                  />
                  Copy Ms. Francis
                </label>
              </div>
              <div className="card-pad">
                {filled === 0 ? (
                  <Empty icon="✉" title="Start typing your notes">
                    The email builds itself as you add points on the left.
                  </Empty>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 8 }}>
                      <strong>Subject:</strong> {subject}
                    </div>
                    <pre style={{
                      whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13.5, margin: 0,
                      background: 'var(--spx-green-50)', padding: '14px 16px', borderRadius: 6,
                      border: '1px solid var(--line)', maxHeight: 460, overflowY: 'auto',
                    }}>{emailBody}</pre>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      <a className="btn btn-primary" href={mailto}>✉ Open in email</a>
                      <button className="btn" onClick={copy}>⧉ Copy</button>
                      <button className="btn" onClick={save}>Save notes</button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {store.pecNotes.length > 0 && (
              <div className="card no-print">
                <div className="card-head"><h2>Past PEC meetings</h2></div>
                <div className="month-list">
                  {store.pecNotes.map((n) => (
                    <div className="month-row" key={n.id}>
                      <div className="when">{n.meetingDate}</div>
                      <div className="what">
                        {n.points.length + n.feedbackOnMinutes.length + n.actions.length} points
                        {n.actions.length > 0 && <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{n.actions.length} follow-up{n.actions.length === 1 ? '' : 's'}</div>}
                      </div>
                      <div className="who">
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            setMeetingDate(n.meetingDate)
                            setAttendees(n.attendees ?? '')
                            setBuckets({
                              points: [...n.points, ''],
                              feedbackOnMinutes: [...n.feedbackOnMinutes, ''],
                              actions: [...n.actions, ''],
                            })
                          }}
                        >Open</button>
                        <button className="btn btn-sm btn-danger" onClick={() => store.deletePecNote(n.id)}>Delete</button>
                      </div>
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
