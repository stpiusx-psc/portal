/** Date helpers. Everything is handled as a plain YYYY-MM-DD string so there
 *  are no timezone surprises when a volunteer in Vancouver edits a date. */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Parse YYYY-MM-DD into a local-noon Date (noon avoids DST edge cases). */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** '2026-11-22' -> 'Sun 22 Nov 2026' */
export function formatLong(iso: string): string {
  const d = parseISO(iso)
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

/** '2026-11-22' -> '22 Nov' */
export function formatShort(iso: string): string {
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

/** '2026-11' -> 'November 2026' */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7)
}

export function todayISO(): string {
  return toISO(new Date())
}

/**
 * The school year runs September → June. Given a year label like '2026-27',
 * return the ordered list of month keys it covers (Sep 2026 … Jun 2027),
 * plus August at the front because Craft Fair and BBQ prep starts then.
 */
export function schoolYearMonths(schoolYear: string): string[] {
  const startYear = Number(schoolYear.slice(0, 4))
  const keys: string[] = []
  // August of the start year through July of the next.
  for (let m = 8; m <= 12; m++) keys.push(`${startYear}-${String(m).padStart(2, '0')}`)
  for (let m = 1; m <= 7; m++) keys.push(`${startYear + 1}-${String(m).padStart(2, '0')}`)
  return keys
}

export type Grain = 'month' | 'bimester' | 'semester' | 'year'

/** Human label for a range of month keys. */
export function rangeLabel(months: string[]): string {
  if (months.length === 0) return ''
  if (months.length === 1) return formatMonthKey(months[0])
  return `${formatMonthKey(months[0])} – ${formatMonthKey(months[months.length - 1])}`
}

/**
 * Split the school year into buckets of the requested grain.
 * Bimester = 2 months, semester = 5 months (Aug–Dec / Jan–Jul as the school
 * splits its terms), year = everything.
 */
export function buckets(schoolYear: string, grain: Grain): { label: string; months: string[] }[] {
  const all = schoolYearMonths(schoolYear)
  if (grain === 'year') return [{ label: `School year ${schoolYear}`, months: all }]
  if (grain === 'semester') {
    const first = all.slice(0, 5)   // Aug – Dec
    const second = all.slice(5)     // Jan – Jul
    return [
      { label: `Term 1 · ${rangeLabel(first)}`, months: first },
      { label: `Term 2 · ${rangeLabel(second)}`, months: second },
    ]
  }
  const size = grain === 'bimester' ? 2 : 1
  const out: { label: string; months: string[] }[] = []
  for (let i = 0; i < all.length; i += size) {
    const chunk = all.slice(i, i + size)
    out.push({ label: rangeLabel(chunk), months: chunk })
  }
  return out
}

/** Days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000)
}

/** Calendar grid for a month: 6 weeks × 7 days of ISO strings (or null). */
export function monthGrid(monthKey: string): (string | null)[][] {
  const [y, m] = monthKey.split('-').map(Number)
  const first = new Date(y, m - 1, 1, 12)
  const daysInMonth = new Date(y, m, 0).getDate()
  const lead = first.getDay()
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
