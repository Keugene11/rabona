type CourseData = Record<string, { name: string; courses: string[] }>
type ResidenceHall = { value: string; label: string; group?: string }

export interface UniversityData {
  MAJORS: string[]
  MINORS: string[]
  COURSES: CourseData
  CLUBS: string[]
  GREEK_LIFE: string[]
  RESIDENCE_HALLS: ResidenceHall[]
}

const cache: Record<string, UniversityData> = {}

export async function getUniversityData(slug: string): Promise<UniversityData> {
  if (cache[slug]) return cache[slug]

  const mod: UniversityData = await import('./cornell')

  const data: UniversityData = {
    MAJORS: mod.MAJORS,
    MINORS: mod.MINORS,
    COURSES: mod.COURSES,
    CLUBS: mod.CLUBS,
    GREEK_LIFE: mod.GREEK_LIFE,
    RESIDENCE_HALLS: mod.RESIDENCE_HALLS,
  }
  cache[slug] = data
  return data
}

// Synchronous search helpers that work with already-loaded course data
export function searchCoursesFromData(courses: CourseData, query: string): string[] {
  const q = query.toUpperCase().trim()
  if (q.length < 2) return []

  const match = q.match(/^([A-Z]{2,5})\s*(\d{0,4})$/)
  if (match) {
    const [, prefix, num] = match
    const dept = courses[prefix]
    if (dept) {
      return dept.courses
        .filter(n => n.startsWith(num))
        .map(n => `${prefix} ${n}`)
    }
  }

  const results: string[] = []
  for (const [code, dept] of Object.entries(courses)) {
    if (code.startsWith(q) || dept.name.toUpperCase().includes(q)) {
      results.push(...dept.courses.slice(0, 5).map(n => `${code} ${n}`))
    }
  }
  return results.slice(0, 15)
}

export function getMatchingDeptsFromData(courses: CourseData, query: string): { code: string; name: string }[] {
  const q = query.toUpperCase().trim()
  if (q.length < 1) return []

  return Object.entries(courses)
    .filter(([code, dept]) =>
      code.startsWith(q) || dept.name.toUpperCase().includes(q)
    )
    .map(([code, dept]) => ({ code, name: dept.name }))
    .slice(0, 8)
}
