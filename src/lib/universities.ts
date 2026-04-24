export interface University {
  slug: string
  name: string
  shortName: string
  emailDomain: string
}

// Known university email domains. Used only to auto-tag the `university`
// field on a new profile — NOT to gate signup. Anyone can sign up.
export const UNIVERSITIES: University[] = [
  { slug: 'stonybrook', name: 'Stony Brook University', shortName: 'Stony Brook', emailDomain: 'stonybrook.edu' },
  { slug: 'harvard',    name: 'Harvard University',     shortName: 'Harvard',     emailDomain: 'harvard.edu' },
  { slug: 'yale',       name: 'Yale University',        shortName: 'Yale',        emailDomain: 'yale.edu' },
  { slug: 'princeton',  name: 'Princeton University',   shortName: 'Princeton',   emailDomain: 'princeton.edu' },
  { slug: 'columbia',   name: 'Columbia University',    shortName: 'Columbia',    emailDomain: 'columbia.edu' },
  { slug: 'upenn',      name: 'Penn',                   shortName: 'Penn',        emailDomain: 'upenn.edu' },
  { slug: 'brown',      name: 'Brown University',       shortName: 'Brown',       emailDomain: 'brown.edu' },
  { slug: 'dartmouth',  name: 'Dartmouth College',      shortName: 'Dartmouth',   emailDomain: 'dartmouth.edu' },
  { slug: 'cornell',    name: 'Cornell University',     shortName: 'Cornell',     emailDomain: 'cornell.edu' },
  { slug: 'stanford',   name: 'Stanford University',    shortName: 'Stanford',    emailDomain: 'stanford.edu' },
  { slug: 'caltech',    name: 'Caltech',                shortName: 'Caltech',     emailDomain: 'caltech.edu' },
]

export function getUniversityByEmail(email: string): University | null {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null
  return UNIVERSITIES.find(u => u.emailDomain === domain) ?? null
}

export function getUniversityBySlug(slug: string): University | null {
  return UNIVERSITIES.find(u => u.slug === slug) ?? null
}
