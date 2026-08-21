import type { PecReport } from './types'
import { formatLong } from './dates'

/**
 * Turns a pasted PSC agenda or minutes document into a draft PEC report.
 *
 * The PSC documents follow a very stable shape — numbered sections ("Recent
 * Events", "Upcoming Events", "Ongoing Events", "Parent Volunteering", "Next
 * PSC Meetings"), lettered events with the owners in brackets, and "o" bullets
 * underneath. When Lynda circulates the post-meeting version, the outcomes are
 * appended in red to the same bullets.
 *
 * This is deliberately a DRAFT generator: it classifies sentences into the five
 * buckets the PEC actually cares about and the liaison edits before sending.
 * Nothing is invented — every line comes from the source text.
 */

const SECTION_PATTERNS: { key: Section; re: RegExp }[] = [
  { key: 'recent', re: /^\s*\d?\)?\s*recent\s+events/i },
  { key: 'upcoming', re: /^\s*\d?\)?\s*upcoming\s+events/i },
  { key: 'ongoing', re: /^\s*\d?\)?\s*ongoing\s+events/i },
  { key: 'volunteering', re: /^\s*\d?\)?\s*parent\s+volunteer/i },
  { key: 'next', re: /^\s*\d?\)?\s*next\s+psc\s+meeting/i },
  { key: 'new', re: /^\s*(new\s+(item|idea)|\d?\)?\s*new\s+(item|idea))/i },
]

type Section = 'recent' | 'upcoming' | 'ongoing' | 'volunteering' | 'next' | 'new' | 'other'

const MONEY_RE = /\$\s?[\d,]+(?:\.\d{2})?k?/i
const RAISED_RE = /\b(raised|proceeds|profit|revenue|broke[- ]even|net|income|cost|expenses|donation)\b/i
const DECISION_RE = /\b(was agreed|it was agreed|agreed that|we agreed|it is proposed|proposed that|decided|resolved|confirmed that|do not repeat|will not|has been agreed|moving ahead|move forwards?)\b/i
const ASK_RE = /\b(looking for|still looking|need(?:s|ed)? (?:a |an |to )?(?:volunteer|coordinator|someone|help|support)|no response|volunteer needed|coordinator needed|seeking|requires? teacher|awaiting|waiting (?:on|to hear)|unable to|cannot|can't|struggling)\b/i
const DATE_RE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\b/i

/**
 * Normalise the text. Word paste keeps paragraph breaks, but a PDF paste can
 * collapse the whole document onto a handful of lines with the structural
 * markers stranded mid-line. Explode those markers back onto their own lines
 * so the section parser works on either kind of input.
 */
function normalise(raw: string): string {
  return raw
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    // Numbered sections: " 3) Upcoming Events:"
    .replace(/\s(\d\))\s+(?=[A-Z])/g, '\n$1 ')
    // Lettered events: " b) Scholastic Book Fair"
    .replace(/\s([a-z]\))\s+(?=[A-Z(])/g, '\n$1 ')
    // The "o" bullet used throughout these documents.
    .replace(/\s+o\s+(?=[A-Z(])/g, '\no ')
    .replace(/\s*([\u25cf\u2022])\s*/g, '\n\u2022 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Preamble lines that are never report content. */
const SKIP_LINE_RE = /^(attendees?|apologies|in attendance|regrets|absent|\*?\s*outputs from meeting|opening prayer)\b/i

/** Split into logical lines, rejoining soft-wrapped fragments. */
function toLines(text: string): string[] {
  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const out: string[] = []
  for (const line of rawLines) {
    const prev = out[out.length - 1]
    const startsNewBlock =
      /^([0-9]+\)|[a-z]\)|o\s|\u25cf|\u2022|-|\*)/i.test(line) ||
      SECTION_PATTERNS.some((p) => p.re.test(line))
    // A PDF export drops single words onto their own line. Anything short that
    // does not open a new block and does not close a sentence is a wrap.
    const isFragment = !startsNewBlock && line.length < 40 && !/[.:!?]$/.test(line)
    if (prev && isFragment) out[out.length - 1] = `${prev} ${line}`
    else out.push(line)
  }
  return out
}

/** Strip bullet markers and the leading letter/number label. */
function clean(line: string): string {
  return line
    .replace(/^([0-9]+\)|[a-z]\)|o\s+|●|•|[-*])\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
}

/** Pull the event name out of a lettered heading like "a) Runathon (Lynda)". */
function headingName(line: string): string | null {
  const m = line.match(/^[a-z]\)\s*([^(]{2,80}?)\s*(\(|$)/i)
  if (m) {
    const name = m[1].replace(/[:.]$/, '').trim()
    if (name.length > 2) return name
  }
  // Older minutes (e.g. May 2025) use a bold Title Case line instead of a
  // lettered label: "First Holy Communion Reception (May 4)". Detect a short,
  // mostly-capitalised line that does not close a sentence.
  if (/^([0-9]+\)|[a-z]\)|o\s|\u25cf|\u2022|[-*])/i.test(line)) return null
  const bare = line.replace(/\s*\([^)]*\)\s*$/, '').replace(/[:.]$/, '').trim()
  if (bare.length < 3 || bare.length > 60) return null
  if (/[.!?]$/.test(line)) return null
  const words = bare.split(/\s+/)
  if (words.length > 7) return null
  const caps = words.filter((w) => /^[A-Z0-9]/.test(w)).length
  return caps / words.length >= 0.6 ? bare : null
}

export interface ParsedSource {
  meetingDate: string | null
  isMinutes: boolean
  sections: Record<Section, { heading: string | null; lines: string[] }[]>
}

/** Look for "Meeting: November 18, 2025" in the header. */
export function extractMeetingDate(text: string): string | null {
  const m = text.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
  )
  if (!m) return null
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december']
  const mi = months.indexOf(m[1].toLowerCase())
  if (mi < 0) return null
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`
}

export function parseSource(raw: string): ParsedSource {
  const text = normalise(raw)
  const lines = toLines(text)
  const sections: ParsedSource['sections'] = {
    recent: [], upcoming: [], ongoing: [], volunteering: [], next: [], new: [], other: [],
  }
  let current: Section = 'other'
  let group: { heading: string | null; lines: string[] } | null = null

  const push = () => {
    if (group && (group.heading || group.lines.length)) sections[current].push(group)
    group = null
  }

  for (const line of lines) {
    if (SKIP_LINE_RE.test(clean(line))) { push(); current = 'other'; continue }
    const sec = SECTION_PATTERNS.find((p) => p.re.test(line))
    if (sec) {
      push()
      current = sec.key
      // "New Item For Consideration - The Card Project" carries its own heading.
      if (sec.key === 'new') group = { heading: clean(line), lines: [] }
      continue
    }
    const name = headingName(line)
    if (name) {
      push()
      group = { heading: line.replace(/^[a-z]\)\s*/i, '').trim(), lines: [] }
      continue
    }
    if (!group) group = { heading: null, lines: [] }
    group.lines.push(clean(line))
  }
  push()

  return {
    meetingDate: extractMeetingDate(text),
    // The post-meeting version says so explicitly, or is titled "Minutes".
    isMinutes: /outputs\s+from\s+meeting|minutes\s+for\s+meeting|\bminutes\b/i.test(text),
    sections,
  }
}

function bullet(heading: string | null, sentence: string): string {
  if (!heading) return sentence
  // Do not repeat the event name if the sentence already leads with it.
  const short = heading.replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (sentence.toLowerCase().startsWith(short.toLowerCase())) return sentence
  return `${short} — ${sentence}`
}

export function generateReport(raw: string, opts: { pecMeetingDate?: string } = {}): PecReport {
  const parsed = parseSource(raw)
  const highlights: string[] = []
  const decisions: string[] = []
  const financials: string[] = []
  const asksForPec: string[] = []
  const upcoming: string[] = []

  const consider = (heading: string | null, line: string, section: Section) => {
    for (const s of sentences(line)) {
      // Fragments and bare name lists are noise, not report content.
      if (s.length < 25) continue
      if (!/\s/.test(s)) continue
      const b = bullet(heading, s)
      if (MONEY_RE.test(s) || (RAISED_RE.test(s) && /\d/.test(s))) {
        if (!financials.includes(b)) financials.push(b)
        continue
      }
      if (DECISION_RE.test(s)) {
        if (!decisions.includes(b)) decisions.push(b)
        continue
      }
      if (ASK_RE.test(s)) {
        if (!asksForPec.includes(b)) asksForPec.push(b)
        continue
      }
      if (section === 'recent' && !highlights.includes(b)) highlights.push(b)
      else if (section === 'upcoming' && DATE_RE.test(s) && !upcoming.includes(b)) upcoming.push(b)
    }
  }

  for (const sec of ['recent', 'upcoming', 'ongoing', 'volunteering', 'new'] as Section[]) {
    for (const g of parsed.sections[sec]) {
      // An event heading with no detail underneath is still worth listing.
      if (g.heading && g.lines.length === 0) {
        const target = sec === 'upcoming' ? upcoming : highlights
        if (!target.includes(g.heading)) target.push(g.heading)
      }
      for (const line of g.lines) consider(g.heading, line, sec)
    }
  }

  // Every upcoming event heading belongs in the "what's next" list.
  for (const g of parsed.sections.upcoming) {
    if (g.heading) {
      const name = g.heading.replace(/\s*\([^)]*\)\s*$/, '').trim()
      if (!upcoming.some((u) => u.startsWith(name))) upcoming.unshift(g.heading)
    }
  }

  const date = parsed.meetingDate
  return {
    id: `report-${date ?? Date.now()}`,
    sourceMeetingDate: date ?? '',
    pecMeetingDate: opts.pecMeetingDate,
    title: date
      ? `PEC Report — PSC meeting of ${formatLong(date)}`
      : 'PEC Report — PSC meeting',
    createdAt: new Date().toISOString(),
    highlights,
    decisions,
    financials,
    asksForPec,
    upcoming,
    sourceText: raw,
  }
}

/** Render the report as plain text, for pasting into an email. */
export function reportToText(r: PecReport): string {
  const block = (title: string, items: string[]) =>
    items.length ? `${title.toUpperCase()}\n${items.map((i) => `  • ${i}`).join('\n')}\n` : ''
  return [
    r.title,
    r.pecMeetingDate ? `For the PEC meeting of ${formatLong(r.pecMeetingDate)}` : '',
    '',
    block('Highlights', r.highlights),
    block('Decisions taken', r.decisions),
    block('Financials', r.financials),
    block('For PEC attention / asks', r.asksForPec),
    block('Coming up', r.upcoming),
    '',
    'Prepared by the PEC liaison from the PSC minutes.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Render as Markdown, for pasting into a doc. */
export function reportToMarkdown(r: PecReport): string {
  const block = (title: string, items: string[]) =>
    items.length ? `## ${title}\n\n${items.map((i) => `- ${i}`).join('\n')}\n` : ''
  return [
    `# ${r.title}`,
    r.pecMeetingDate ? `_For the PEC meeting of ${formatLong(r.pecMeetingDate)}_` : '',
    '',
    block('Highlights', r.highlights),
    block('Decisions taken', r.decisions),
    block('Financials', r.financials),
    block('For PEC attention / asks', r.asksForPec),
    block('Coming up', r.upcoming),
  ]
    .filter(Boolean)
    .join('\n')
}
