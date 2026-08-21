/** Domain model for the St. Pius X PSC portal. */

export type EventCategory =
  | 'fundraiser'
  | 'community'
  | 'faith'
  | 'school-support'
  | 'ongoing'
  | 'governance'

/** How much we trust the date currently on the record. */
export type DateConfidence =
  /** Rolled forward from last year's date — must be agreed with the school. */
  | 'proposed'
  /** Agreed with Ms. Francis / the parish and locked in. */
  | 'confirmed'
  /** No date yet; the event is expected in the stated month. */
  | 'tbd'

export type EventStatus = 'active' | 'discontinued' | 'idea'

export interface MoneyActual {
  year: string
  revenue?: number
  costs?: number
  net?: number
  note?: string
}

export interface PrepTask {
  /** Month key the task belongs to, e.g. '2026-09'. */
  month: string
  /** Week within the month, as used in the PSC Timeline ("Wk 1", "Wk 2/3"). */
  week: string
  task: string
  owner?: string
  done?: boolean
}

export interface PlaybookSection {
  title: string
  items: string[]
}

export interface DriveDoc {
  title: string
  url: string
  kind: 'doc' | 'sheet' | 'slides' | 'pdf' | 'folder' | 'form'
  note?: string
}

export interface PscEvent {
  id: string
  name: string
  category: EventCategory
  status: EventStatus
  /** ISO date (YYYY-MM-DD) for single-day events, or the start date of a range. */
  date: string | null
  endDate?: string | null
  /** Month bucket used when there is no date yet, e.g. '2026-10'. */
  monthHint?: string
  dateConfidence: DateConfidence
  /** What last year's date was, so the roll-forward can be audited. */
  priorYearDate?: string
  /** Main responsible person. Editable in the portal. */
  mainResp: string[]
  supportResp?: string[]
  /** SignUpGenius (or other) volunteer sign-up link. */
  signUpUrl?: string
  /** true when the event needs volunteers recruited via sign-up. */
  needsVolunteers: boolean
  volunteerCount?: number
  /** Assigned budget for this year, in CAD. */
  budget?: number
  /** What the event actually did in prior years. */
  actuals?: MoneyActual[]
  summary: string
  /** Longer-form "what this event is" for the playbook tab. */
  description?: string
  /** Step-by-step run sheet, grouped into sections. */
  playbook?: PlaybookSection[]
  /** Lessons learned / debrief carried forward. */
  lessons?: string[]
  /** Prep tasks pulled from the PSC Timeline. */
  prep?: PrepTask[]
  docs?: DriveDoc[]
  /** Free-text notes, editable in the portal. */
  notes?: string
  /** Set true for the handful of events that need a full committee. */
  majorEvent?: boolean
}

export interface Meeting {
  id: string
  kind: 'PSC' | 'PEC'
  date: string
  time?: string
  location?: string
  note?: string
}

export interface TeamMember {
  /** Database id. Absent for members that come from the code seed. */
  id?: number
  name: string
  /**
   * The person's committee position (Chair, Committee, Principal).
   * NOT an access level — that lives in the psc_members roster.
   */
  role: string
  /** Set false when a family leaves the school; keeps the history readable. */
  active?: boolean
  /** Areas this person owns, as free text. Assignments come from the events. */
  involvement: string[]
  sortOrder?: number
}

/** A generated report for the PEC, derived from a PSC agenda or minutes. */
export interface PecReport {
  id: string
  /** Which PSC meeting this summarises. */
  sourceMeetingDate: string
  /** When the PEC meeting it feeds is held. */
  pecMeetingDate?: string
  title: string
  createdAt: string
  highlights: string[]
  decisions: string[]
  financials: string[]
  asksForPec: string[]
  upcoming: string[]
  /** The raw text that was pasted in, kept for traceability. */
  sourceText?: string
}

/** Notes captured live during a PEC meeting, to be sent back to the PSC chair. */
export interface PecMeetingNote {
  id: string
  meetingDate: string
  attendees?: string
  /** Points raised at the PEC that the PSC should know about. */
  points: string[]
  /** Direct feedback on the PSC minutes. */
  feedbackOnMinutes: string[]
  /** Things Jorge committed to follow up on. */
  actions: string[]
  createdAt: string
  sentAt?: string
}

export interface PortalData {
  schoolYear: string
  events: PscEvent[]
  meetings: Meeting[]
  team: TeamMember[]
  reports: PecReport[]
  pecNotes: PecMeetingNote[]
}
