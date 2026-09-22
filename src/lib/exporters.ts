import type { PscEvent } from './types'
import { formatLong, parseISO, toISO } from './dates'

function download(filename: string, mime: string, text: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(filename: string, text: string) {
  download(filename, 'text/plain', text)
}

export function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  download(filename, 'text/csv', rows.map((r) => r.map(esc).join(',')).join('\n'))
}

export function eventsToCsv(events: PscEvent[]): string[][] {
  const head = [
    'Event', 'Category', 'Status', 'Date', 'End date', 'Date confidence',
    'Prior year date', 'Main responsible', 'Support', 'Volunteers needed',
    'Volunteer slots', 'Budget (CAD)', 'Sign-up link', 'Summary', 'Notes',
  ]
  const rows = events.map((e) => [
    e.name,
    e.category,
    e.status,
    e.date ?? (e.monthHint ? `${e.monthHint} (month only)` : 'TBD'),
    e.endDate ?? '',
    e.dateConfidence,
    e.priorYearDate ?? '',
    e.mainResp.join('; '),
    (e.supportResp ?? []).join('; '),
    e.needsVolunteers ? 'Yes' : 'No',
    e.volunteerCount ? String(e.volunteerCount) : '',
    e.budget != null ? String(e.budget) : '',
    e.signUpUrl ?? '',
    e.summary,
    e.notes ?? '',
  ])
  return [head, ...rows]
}

/** Escape a text value for an iCalendar property. */
function icsEsc(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function icsDate(iso: string): string {
  return iso.replace(/-/g, '')
}

/** Fold long lines to 75 octets as iCalendar requires. */
function fold(line: string): string {
  if (line.length <= 73) return line
  const out: string[] = []
  let rest = line
  out.push(rest.slice(0, 73))
  rest = rest.slice(73)
  while (rest.length) {
    out.push(` ${rest.slice(0, 72)}`)
    rest = rest.slice(72)
  }
  return out.join('\r\n')
}

/**
 * All-day VEVENTs so the calendar imports cleanly into Google Calendar.
 * DTEND is exclusive for all-day events, hence the +1 day.
 */
export function toIcs(events: PscEvent[], calName: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//St. Pius X PSC Portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEsc(calName)}`,
  ]
  const stamp = `${toISO(new Date()).replace(/-/g, '')}T000000Z`
  for (const e of events) {
    if (!e.date) continue
    const end = parseISO(e.endDate ?? e.date)
    end.setDate(end.getDate() + 1)
    const owners = e.mainResp.length ? `Lead: ${e.mainResp.join(', ')}` : 'Lead: TBD'
    const conf = e.dateConfidence === 'confirmed' ? 'Date confirmed' : 'DATE NOT YET CONFIRMED — tentative; check event notes'
    const desc = [
      e.summary,
      e.notes ?? '',
      '',
      owners,
      conf,
      e.budget != null ? `Budget: $${e.budget}` : '',
      e.signUpUrl ? `Sign-up: ${e.signUpUrl}` : '',
    ].filter(Boolean).join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@spx-psc`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.date)}`,
      `DTEND;VALUE=DATE:${icsDate(toISO(end))}`,
      fold(`SUMMARY:${icsEsc(e.dateConfidence === 'confirmed' ? e.name : `${e.name} (proposed)`)}`),
      fold(`DESCRIPTION:${icsEsc(desc)}`),
      'LOCATION:St. Pius X Elementary School',
      `CATEGORIES:${icsEsc(e.category)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(filename: string, events: PscEvent[], calName: string) {
  download(filename, 'text/calendar', toIcs(events, calName))
}

/** Plain-text agenda, handy for pasting into an email or the bulletin. */
export function eventsToText(events: PscEvent[], title: string, detail: 'summary' | 'standard' | 'full'): string {
  const out: string[] = [title, '='.repeat(title.length), '']
  for (const e of events) {
    const when = e.date ? formatLong(e.date) + (e.endDate ? ` – ${formatLong(e.endDate)}` : '') : 'Date TBD'
    const flag = e.dateConfidence === 'confirmed' ? '' : ' [proposed]'
    out.push(`${when}${flag} — ${e.name}`)
    if (detail === 'summary') continue
    out.push(`    Lead: ${e.mainResp.length ? e.mainResp.join(', ') : 'TBD'}`)
    if (e.budget != null) out.push(`    Budget: $${e.budget}`)
    if (e.needsVolunteers) out.push(`    Volunteers: ${e.volunteerCount ? `${e.volunteerCount} slots` : 'needed'}${e.signUpUrl ? ` — ${e.signUpUrl}` : ''}`)
    out.push(`    ${e.summary}`)
    if (e.notes) out.push(`    Notes: ${e.notes}`)
    if (detail === 'full') {
      if (e.supportResp?.length) out.push(`    Support: ${e.supportResp.join(', ')}`)
      if (e.actuals?.length) {
        for (const a of e.actuals) {
          const bits = [a.revenue != null ? `revenue $${a.revenue}` : '', a.costs != null ? `costs $${a.costs}` : '', a.net != null ? `net $${a.net}` : '']
          out.push(`    ${a.year} actual: ${bits.filter(Boolean).join(', ')}`)
        }
      }
      if (e.lessons?.length) {
        out.push('    Lessons learned:')
        for (const l of e.lessons) out.push(`      - ${l}`)
      }
    }
    out.push('')
  }
  return out.join('\n')
}

/** Print the page (or a print-scoped section) — the browser turns it into a PDF. */
export function printView() {
  window.print()
}
