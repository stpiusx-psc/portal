import { useRef, useState } from 'react'
import type { Store } from '../lib/store'
import type { PecReport } from '../lib/types'
import { Banner, Chip, Empty, PrintHead } from '../components/ui'
import { generateReport, reportToMarkdown, reportToText } from '../lib/pecReport'
import { formatLong, todayISO } from '../lib/dates'
import { downloadText, printView } from '../lib/exporters'
import { ACCEPTED_FILES, readDocumentFile } from '../lib/docText'
import { useAuth } from '../lib/auth'
import { REMOTE_ENABLED } from '../lib/supabase'

type Bucket = keyof Pick<PecReport, 'highlights' | 'decisions' | 'financials' | 'asksForPec' | 'upcoming'>
/** The parsed buckets plus the liaison's own notes, which no parser fills. */
type EditableList = Bucket | 'liaisonNotes'

const BUCKETS: { key: Bucket; label: string; help: string }[] = [
  { key: 'highlights', label: 'Highlights', help: 'What happened since the last PEC meeting.' },
  { key: 'decisions', label: 'Decisions taken', help: 'Anything the PSC agreed that the PEC should know.' },
  { key: 'financials', label: 'Financials', help: 'Money raised, costs, break-even results.' },
  { key: 'asksForPec', label: 'For PEC attention / asks', help: 'Gaps, blockers and requests for help.' },
  { key: 'upcoming', label: 'Coming up', help: 'What is next on the PSC calendar.' },
]

export function ReportsView({ store }: { store: Store }) {
  const auth = useAuth()
  const [raw, setRaw] = useState('')
  const [draft, setDraft] = useState<PecReport | null>(null)
  const [pecDate, setPecDate] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const run = (text = raw) => {
    if (text.trim().length < 40) {
      setStatus('Add the PSC agenda or minutes first — there is not enough text to work with.')
      return
    }
    const r = generateReport(text, { pecMeetingDate: pecDate || undefined })
    setDraft(r)
    const total = BUCKETS.reduce((s, b) => s + r[b.key].length, 0)
    setStatus(
      total === 0
        ? 'Nothing could be extracted automatically. Check the text pasted correctly, or add the points by hand below.'
        : `Draft built: ${total} points found${r.sourceMeetingDate ? ` from the meeting of ${formatLong(r.sourceMeetingDate)}` : ''}. Review and edit before sending.`,
    )
  }

  const takeFile = async (file: File | undefined | null) => {
    if (!file) return
    setBusy(true)
    setStatus(`Reading ${file.name}…`)
    const res = await readDocumentFile(file)
    setBusy(false)
    if (!res.ok) { setStatus(res.note); return }
    setRaw(res.text)
    // Reading the file is the instruction to draft the report; a second button
    // press in between would be ceremony.
    run(res.text)
  }

  const editBullet = (bucket: EditableList, idx: number, value: string) => {
    setDraft((d) => {
      if (!d) return d
      const next = [...(d[bucket] ?? [])]
      if (value.trim() === '') next.splice(idx, 1)
      else next[idx] = value
      return { ...d, [bucket]: next }
    })
  }

  const addBullet = (bucket: EditableList) => {
    setDraft((d) => (d ? { ...d, [bucket]: [...(d[bucket] ?? []), ''] } : d))
  }

  const move = (bucket: EditableList, idx: number, dir: -1 | 1) => {
    setDraft((d) => {
      if (!d) return d
      const next = [...(d[bucket] ?? [])]
      const j = idx + dir
      if (j < 0 || j >= next.length) return d
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return { ...d, [bucket]: next }
    })
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Copied to the clipboard.')
    } catch {
      setStatus('Could not reach the clipboard — use the download button instead.')
    }
  }

  // The liaison's own working area. A report carries the committee's asks and
  // its financial position before either has been put to the PEC, so it is not
  // for editors generally — the principal and the PEC chair are editors.
  if (REMOTE_ENABLED && !auth.isAdmin) {
    return (
      <>
        <header className="topbar no-print"><div><h1>PEC Reports</h1></div></header>
        <div className="content">
          <Empty icon="✎" title="Administrators only">
            This is where the PSC/PEC liaison drafts the monthly report. Ask Jorge Chinchilla if you need something from it.
          </Empty>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="topbar no-print">
        <div>
          <h1>PEC Reports</h1>
          <p>
            Upload or paste the PSC agenda or minutes that Lynda sends, and this drafts the monthly report for the PEC.
            Every line comes from the source document — nothing is invented. Edit, then export.
          </p>
        </div>
        {draft && (
          <div className="topbar-actions">
            <button className="btn" onClick={() => copy(reportToText(draft))}>⧉ Copy as text</button>
            <button className="btn" onClick={() => copy(reportToMarkdown(draft))}>⧉ Copy as Markdown</button>
            <button className="btn" onClick={() => downloadText(`pec-report-${draft.sourceMeetingDate || todayISO()}.md`, reportToMarkdown(draft))}>⤓ Download</button>
            <button className="btn btn-primary" onClick={printView}>⎙ Print / PDF</button>
          </div>
        )}
      </header>

      <div className="content">
        {status && <Banner tone={status.startsWith('Draft built') || status.startsWith('Copied') ? 'info' : 'warn'}>{status}</Banner>}

        <div className="split">
          <div className="card no-print">
            <div className="card-head"><h2>1 · Add the PSC document</h2></div>
            <div className="card-pad">
              <div
                className={`dropzone${dragging ? ' over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); void takeFile(e.dataTransfer.files?.[0]) }}
                onClick={() => fileInput.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click() } }}
              >
                <strong>Drop the minutes here, or click to choose a file</strong>
                <span>Word (.docx), plain text or Markdown. The report is drafted as soon as the file is read.</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPTED_FILES}
                  hidden
                  onChange={(e) => { void takeFile(e.target.files?.[0]); e.target.value = '' }}
                />
              </div>

              <p className="or-paste">or paste it instead</p>

              <label className="field">
                <span>PSC agenda or minutes</span>
                <textarea
                  rows={16}
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder={'Paste the text here if you would rather not upload the file.\n\nBoth versions work — the agenda before the meeting, and the minutes with the outputs in red afterwards.'}
                />
                <span className="hint">
                  Paste from Word for the cleanest result. Pasting from a PDF also works.
                </span>
              </label>

              <label className="field">
                <span>PEC meeting this report is for (optional)</span>
                <input type="date" value={pecDate} onChange={(e) => setPecDate(e.target.value)} />
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => run()} disabled={busy}>Build the draft report</button>
                {raw && <button className="btn btn-ghost" onClick={() => { setRaw(''); setDraft(null); setStatus(null) }}>Clear</button>}
              </div>
            </div>
          </div>

          <div>
            {!draft ? (
              <div className="card">
                <Empty icon="✎" title="No draft yet">
                  Paste the PSC document on the left and press <strong>Build the draft report</strong>.
                </Empty>
              </div>
            ) : (
              <div className="report-out">
                <PrintHead title={draft.title} subtitle={draft.pecMeetingDate ? `For the PEC meeting of ${formatLong(draft.pecMeetingDate)}` : undefined} />
                <div className="no-print">
                  <h2>{draft.title}</h2>
                  {draft.pecMeetingDate && (
                    <p style={{ margin: '4px 0 0', color: 'var(--ink-muted)', fontSize: 13 }}>
                      For the PEC meeting of {formatLong(draft.pecMeetingDate)}
                    </p>
                  )}
                </div>

                {BUCKETS.map((b) => (
                  <section key={b.key}>
                    <h3>
                      {b.label}
                      <span className="no-print" style={{ float: 'right', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                        <Chip tone="plain">{draft[b.key].length}</Chip>
                      </span>
                    </h3>
                    {draft[b.key].length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic', margin: 0 }}>
                        Nothing here. <span className="no-print">{b.help}</span>
                      </p>
                    ) : (
                      <ul>
                        {draft[b.key].map((item, i) => (
                          <li key={i}>
                            <span className="print-only">{item}</span>
                            <span className="no-print bullet-edit">
                              <textarea
                                rows={Math.max(2, Math.ceil(item.length / 46))}
                                value={item}
                                onChange={(ev) => editBullet(b.key, i, ev.target.value)}
                                aria-label={`${b.label} point ${i + 1}`}
                              />
                              <button className="btn btn-sm btn-ghost" title="Move up" onClick={() => move(b.key, i, -1)}>↑</button>
                              <button className="btn btn-sm btn-ghost" title="Move down" onClick={() => move(b.key, i, 1)}>↓</button>
                              <button className="btn btn-sm btn-ghost" title="Remove" onClick={() => editBullet(b.key, i, '')}>✕</button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button className="btn btn-sm btn-ghost no-print" style={{ marginTop: 4 }} onClick={() => addBullet(b.key)}>+ Add a point</button>
                  </section>
                ))}

                <section className="liaison-notes no-print">
                  <h3>My notes from the PEC meeting</h3>
                  <p className="ln-sub">
                    Yours, not the PSC's. Nothing here is taken from the minutes, and none of it
                    goes into the report you copy, download or print — the report goes <em>to</em> the
                    PEC, these stay with you. Use them for what was said, what to chase and what to
                    bring back to Lynda.
                  </p>
                  {(draft.liaisonNotes ?? []).length === 0 ? (
                    <p className="ln-empty">No notes on this one yet.</p>
                  ) : (
                    <ul>
                      {(draft.liaisonNotes ?? []).map((item, i) => (
                        <li key={i}>
                          <span className="bullet-edit">
                            <textarea
                              rows={Math.max(2, Math.ceil(item.length / 46))}
                              value={item}
                              onChange={(ev) => editBullet('liaisonNotes', i, ev.target.value)}
                              aria-label={`My note ${i + 1}`}
                              placeholder="What happened, what was asked, what to follow up"
                            />
                            <button className="btn btn-sm btn-ghost" title="Move up" onClick={() => move('liaisonNotes', i, -1)}>↑</button>
                            <button className="btn btn-sm btn-ghost" title="Move down" onClick={() => move('liaisonNotes', i, 1)}>↓</button>
                            <button className="btn btn-sm btn-ghost" title="Remove" onClick={() => editBullet('liaisonNotes', i, '')}>✕</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" onClick={() => addBullet('liaisonNotes')}>+ Add a note</button>
                    {(draft.liaisonNotes ?? []).length > 0 && (
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => copy((draft.liaisonNotes ?? []).map((n) => `- ${n}`).join('\n'))}
                      >
                        ⧉ Copy my notes
                      </button>
                    )}
                  </div>
                </section>

                <div className="no-print" style={{ marginTop: 22, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const n = (draft.liaisonNotes ?? []).filter((x) => x.trim()).length
                      store.saveReport({ ...draft, pecMeetingDate: pecDate || draft.pecMeetingDate })
                      setStatus(n ? `Report saved, with ${n} of your own note${n === 1 ? '' : 's'}.` : 'Report saved to this portal.')
                    }}
                  >
                    Save this report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {store.reports.length > 0 && (
          <div className="card no-print" style={{ marginTop: 20 }}>
            <div className="card-head"><h2>Saved reports</h2></div>
            <div className="month-list">
              {store.reports.map((r) => (
                <div className="month-row" key={r.id}>
                  <div className="when">{r.createdAt.slice(0, 10)}</div>
                  <div className="what">
                    <button className="linkish" onClick={() => { setDraft(r); setRaw(r.sourceText ?? ''); setPecDate(r.pecMeetingDate ?? '') }}>
                      {r.title}
                    </button>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
                      {BUCKETS.map((b) => `${r[b.key].length} ${b.label.toLowerCase()}`).join(' · ')}
                      {(r.liaisonNotes ?? []).length > 0 && (
                        <> · <strong>{r.liaisonNotes!.length} of your notes</strong></>
                      )}
                    </div>
                  </div>
                  <div className="who">
                    <button className="btn btn-sm btn-danger" onClick={() => store.deleteReport(r.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
