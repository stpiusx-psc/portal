import type { ReactNode } from 'react'
import type { DateConfidence, EventCategory, PscEvent } from '../lib/types'
import { formatLong, formatMonthKey } from '../lib/dates'

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  fundraiser: 'Fundraiser',
  community: 'Community',
  faith: 'Faith',
  'school-support': 'School support',
  ongoing: 'Ongoing',
  governance: 'Governance',
}

export function Chip({ children, tone, category }: { children: ReactNode; tone?: 'ok' | 'warn' | 'danger' | 'plain'; category?: EventCategory }) {
  const cls = ['chip']
  if (tone) cls.push(`chip-${tone}`)
  if (category) cls.push(`cat-${category}`)
  return <span className={cls.join(' ')}>{children}</span>
}

export function ConfidenceChip({ c }: { c: DateConfidence }) {
  if (c === 'confirmed') return <Chip tone="ok">Confirmed</Chip>
  if (c === 'proposed') return <Chip tone="warn">Proposed</Chip>
  return <Chip tone="plain">Date TBD</Chip>
}

/** "Sun 22 Nov 2026", or the month if we only know the month. */
export function whenLabel(e: PscEvent): string {
  if (e.date) {
    const base = formatLong(e.date)
    return e.endDate && e.endDate !== e.date ? `${base} → ${formatLong(e.endDate)}` : base
  }
  if (e.monthHint) return `${formatMonthKey(e.monthHint)} (month only)`
  return 'Date TBD'
}

export function money(n: number | undefined | null): string {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="big" aria-hidden>{icon}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  )
}

export function Banner(
  { tone = 'info', className, children }:
  { tone?: 'info' | 'warn'; className?: string; children: ReactNode },
) {
  return <div className={`banner banner-${tone}${className ? ` ${className}` : ''}`}>{children}</div>
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  )
}

/** Header that only appears on printed output, so PDFs identify themselves. */
export function PrintHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="print-head">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      <p>St. Pius X Elementary — Parent Standing Committee · Generated {formatLong(new Date().toISOString().slice(0, 10))}</p>
    </div>
  )
}
