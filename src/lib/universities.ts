export interface University {
  slug: string
  name: string
  shortName: string
  emailDomain: string
}

export const UNIVERSITY: University = {
  slug: 'cornell',
  name: 'Cornell University',
  shortName: 'Cornell',
  emailDomain: 'cornell.edu',
}

export const UNIVERSITIES: University[] = [UNIVERSITY]

export const APPROVED_DOMAINS = [UNIVERSITY.emailDomain]

export function getUniversityByEmail(email: string): University | null {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null
  return domain === UNIVERSITY.emailDomain ? UNIVERSITY : null
}

export function getUniversityBySlug(slug: string): University | null {
  return slug === UNIVERSITY.slug ? UNIVERSITY : null
}

export function isApprovedEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return APPROVED_DOMAINS.includes(domain)
}
