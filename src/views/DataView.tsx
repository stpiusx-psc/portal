import { useRef, useState } from 'react'
import type { Store } from '../lib/store'
import { Banner, Chip } from '../components/ui'
import { DRIVE_ROOT } from '../data/events'
import { downloadCsv, downloadIcs, eventsToCsv } from '../lib/exporters'
import { todayISO } from '../lib/dates'

/**
 * Backup and restore. Until a shared database is connected, edits live in this
 * browser only — so exporting a backup is the way to move them between devices
 * or hand them to someone else.
 */
export function DataView({ store }: { store: Store }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const doExport = () => {
    const text = store.exportJson()
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spx-psc-backup-${todayISO()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus({ tone: 'info', text: 'Backup downloaded.' })
  }

  const doImport = async (file: File) => {
    const text = await file.text()
    const res = store.importJson(text)
    setStatus(res.ok
      ? { tone: 'info', text: 'Backup restored. Your calendar edits, reports and notes are back.' }
      : { tone: 'warn', text: `Could not restore: ${res.error}` })
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <header className="topbar no-print">
        <div>
          <h1>Backup &amp; Data</h1>
          <p>Where your edits live, how to back them up, and how to move them to another computer.</p>
        </div>
      </header>

      <div className="content">
        {status && <Banner tone={status.tone}>{status.text}</Banner>}

        <Banner tone="warn">
          <span>
            <strong>Edits are stored in this browser only.</strong> Dates, owners, budgets, reports and meeting notes
            are saved on this device. They are not yet shared with other people, and clearing your browser data will
            remove them. Download a backup regularly, and keep the file in the shared Drive.
          </span>
        </Banner>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-head">
              <h2>Backup</h2>
              <span className="spacer" />
              <Chip tone={store.editedCount > 0 ? 'ok' : 'plain'}>{store.editedCount} events edited</Chip>
            </div>
            <div className="card-pad">
              <p style={{ marginTop: 0, fontSize: 14 }}>
                Downloads one file containing every change you have made: edited events, saved PEC reports and PEC
                meeting notes. Keep it in the shared Drive so it is not tied to one laptop.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={doExport}>⤓ Download backup</button>
                <button className="btn" onClick={() => fileRef.current?.click()}>⤒ Restore from backup</button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f) }}
                />
              </div>
              <p className="hint">Restoring replaces everything currently in this browser.</p>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>Share the calendar</h2></div>
            <div className="card-pad">
              <p style={{ marginTop: 0, fontSize: 14 }}>
                Export in the format each audience actually uses.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  onClick={() => downloadIcs(`spx-psc-${store.schoolYear}.ics`, store.events.filter((e) => e.status !== 'discontinued'), `SPX PSC ${store.schoolYear}`)}
                >
                  ⤓ Google Calendar (.ics)
                </button>
                <button
                  className="btn"
                  onClick={() => downloadCsv(`spx-psc-${store.schoolYear}.csv`, eventsToCsv(store.events))}
                >
                  ⤓ Spreadsheet (.csv)
                </button>
              </div>
              <p className="hint">
                The .ics file imports into Google Calendar (Settings → Import &amp; export). Unconfirmed events are
                labelled “(proposed)” so nobody treats a rolled-forward date as final.
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Where everything comes from</h2></div>
          <div className="card-pad">
            <ul className="plain" style={{ fontSize: 14 }}>
              <li>
                <strong>Events, playbooks and prior-year numbers</strong> were built from the 2025-26 PSC agendas and
                minutes, and from the <a href={DRIVE_ROOT} target="_blank" rel="noreferrer">PSC shared Drive</a> —
                the PSC Timeline, the event folders, the finance sheets and the debriefs.
              </li>
              <li>
                <strong>Dates for {store.schoolYear}</strong> were rolled forward from last year’s actuals and are
                marked <em>Proposed</em> until confirmed with Ms. Francis.
              </li>
              <li>
                <strong>Contact details are not stored in the portal</strong> — they stay in the access-controlled
                contact list on the Drive.
              </li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Start over</h2></div>
          <div className="card-pad">
            <p style={{ marginTop: 0, fontSize: 14 }}>
              Removes every edit and returns the portal to the seeded {store.schoolYear} calendar. Download a backup
              first if there is anything you want to keep.
            </p>
            {confirmReset ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14 }}>Delete all edits, reports and notes?</strong>
                <button className="btn btn-danger" onClick={() => { store.resetAll(); setConfirmReset(false); setStatus({ tone: 'info', text: 'Portal reset to the seeded calendar.' }) }}>
                  Yes, reset everything
                </button>
                <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>Reset the portal</button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
