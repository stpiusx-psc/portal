import type { TeamMember } from '../lib/types'

/**
 * Roles and areas of ownership, taken from the PSC contact list and the
 * 2025-26 minutes.
 *
 * Deliberately NAMES AND ROLES ONLY — no emails or phone numbers. Personal
 * contact details stay in the access-controlled PSC Contact List on the
 * shared Drive so that this portal can be deployed without exposing them.
 */
export const TEAM: TeamMember[] = [
  { name: 'Lynda Freeman', role: 'PSC Chair', involvement: ['Chair', 'Back to School BBQ', 'Christmas Craft Fair', 'Runathon', 'Family Fun Night'] },
  { name: 'Miss C. Francis', role: 'School Principal', involvement: ['Opening prayer', 'School liaison', 'Approvals', 'Payments'] },
  { name: 'Jorge Chinchilla', role: 'PEC Liaison', involvement: ['PSC ↔ PEC reporting'] },
  { name: 'Julie Hogarth', role: 'Committee', involvement: ['Back to School BBQ', 'Hot Lunch', 'Runathon', 'Christmas Craft Fair', 'Sports Day'] },
  { name: 'Stephanie Toves', role: 'Committee', involvement: ['Back to School BBQ', 'Christmas Craft Fair', 'Family Fun Night'] },
  { name: 'Eileen Wilson', role: 'Committee', involvement: ['Hot Lunch', 'Christmas Craft Fair', 'AGM Wine & Cheese', 'The Card Project'] },
  { name: 'Ana Luisa Martinez', role: 'Committee', involvement: ['Kindergarten Potluck', 'Christmas Craft Fair', 'Family Fun Night'] },
  { name: 'Diana Martins-Garbutt', role: 'Committee', involvement: ['Poinsettia Sale', 'Intermediate Speech Arts'] },
  { name: 'Michael Sun', role: 'Hot Lunch Vendor Coordinator', involvement: ['Hot Lunch'] },
  { name: 'Surabhi Anand', role: 'Hot Lunch Coordinator (in training)', involvement: ['Hot Lunch — succession from Michael Sun'] },
  { name: 'Jennifer Dales', role: 'Committee', involvement: ['Used Uniform Sale', 'Scholastic Book Fair', 'Shrove Tuesday Pancakes'] },
  { name: 'Kate Blomfeldt (Parkins)', role: 'Committee', involvement: ['Christmas Craft Fair — vendors', 'Family Fun Night'] },
  { name: 'Olivia Matthews', role: 'Committee', involvement: ['Grade 7 Graduation', 'Christmas Craft Fair — advertising'] },
  { name: 'Veronica Price', role: 'Committee', involvement: ['Kindergarten Potluck', 'Family Fun Night', 'Thank-you notes'] },
  { name: 'Penny Lidstone (Miller)', role: 'Committee', involvement: ['Lost and Found'] },
  { name: 'Shadi Baker', role: 'Committee', involvement: ['Crossing Guard sign-ups', 'Christmas Craft Fair', 'Family Fun Night'] },
  { name: 'Jeannie Ha', role: 'Committee', involvement: ['Teacher Appreciation', 'Volunteer tea'] },
  { name: 'Vivian Bopp', role: 'Committee', involvement: ['Runathon — cash balancing & data entry'] },
  { name: 'Kelsey Swanekamp', role: 'Committee', involvement: ['Christmas Craft Fair — raffle'] },
  { name: 'Parbs Bains', role: 'Committee', involvement: ['Christmas Market'] },
  { name: 'Lina Barrera', role: 'Committee', involvement: ['Christmas Market'] },
  { name: 'Clarizz Calinisan', role: 'Committee', involvement: ['Christmas Market'] },
  { name: 'Ana Cristina Serrano', role: 'Committee', involvement: ['Costume Sale (discontinued 2025)'] },
  { name: 'Jennifer Hetherington', role: 'Committee', involvement: ['Lice Check'] },
  { name: 'Jenny O’Mahony', role: 'Committee', involvement: ['Family Fun Night', 'Lice Check'] },
  { name: 'Lenora Delaney', role: 'Committee', involvement: [] },
  { name: 'Amy Castaldo', role: 'Committee', involvement: [] },
  { name: 'Helena Chun', role: 'Committee', involvement: [] },
  { name: 'Lisa Faist', role: 'Committee', involvement: [] },
]
