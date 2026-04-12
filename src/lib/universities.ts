export interface University {
  slug: string
  name: string
  shortName: string
  emailDomain: string
}

// No university restriction — open to everyone
export const UNIVERSITY: University = {
  slug: 'rabona',
  name: 'Rabona',
  shortName: 'Rabona',
  emailDomain: '',
}

export const UNIVERSITIES: University[] = [UNIVERSITY]

export const APPROVED_DOMAINS: string[] = []

export function getUniversityByEmail(email: string): University | null {
  // No domain restriction — all emails are welcome
  if (!email) return null
  return UNIVERSITY
}

export function getUniversityBySlug(slug: string): University | null {
  return UNIVERSITY
}

export function isApprovedEmail(email: string): boolean {
  // All emails are approved
  return !!email
}
