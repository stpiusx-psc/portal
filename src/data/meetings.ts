import type { Meeting } from '../lib/types'

/**
 * PSC meets the 3rd Tuesday at 2pm in the Parish meeting room.
 * 2025-26 ran Sept 16 / Oct 15 (Wed) / Nov 18 / Dec 16 / Jan 20 / Feb 17 /
 * no March (Spring Break) / Apr 21 / May 19 / June social.
 * The 2026-27 dates below are the equivalent 3rd Tuesdays and still need
 * to be agreed with Ms. Francis and the parish.
 */
export const MEETINGS: Meeting[] = [
  { id: 'psc-2026-09', kind: 'PSC', date: '2026-09-15', time: '2:00 pm', location: 'Parish meeting room', note: 'First meeting of the year — agree dates for the whole year.' },
  { id: 'psc-2026-10', kind: 'PSC', date: '2026-10-20', time: '2:00 pm', location: 'Parish meeting room' },
  { id: 'psc-2026-11', kind: 'PSC', date: '2026-11-17', time: '2:00 pm', location: 'Parish meeting room', note: 'Final Christmas Craft Fair check before the event.' },
  { id: 'psc-2026-12', kind: 'PSC', date: '2026-12-15', time: '2:00 pm', location: 'Parish meeting room' },
  { id: 'psc-2027-01', kind: 'PSC', date: '2027-01-19', time: '2:00 pm', location: 'Parish meeting room' },
  { id: 'psc-2027-02', kind: 'PSC', date: '2027-02-16', time: '2:00 pm', location: 'Parish meeting room' },
  { id: 'psc-2027-04', kind: 'PSC', date: '2027-04-20', time: '2:00 pm', location: 'Parish meeting room', note: 'No March meeting — Spring Break.' },
  { id: 'psc-2027-05', kind: 'PSC', date: '2027-05-18', time: '2:00 pm', location: 'Parish meeting room' },
  { id: 'psc-2027-06', kind: 'PSC', date: '2027-06-15', time: 'TBD', location: 'TBD', note: 'End-of-year social gathering — date to be announced.' },
]
