'use client'

import { useState } from 'react'
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react'
import StyledSelect from '@/components/StyledSelect'
import { CLASS_YEARS, GENDERS, RELATIONSHIP_STATUSES, INTERESTED_IN } from '@/lib/constants'

interface Filters {
  name: string
  residence_hall: string
  course: string
  gender: string
  major: string
  class_year: string
  hometown: string
  high_school: string
  fraternity_sorority: string
  clubs: string
  relationship_status: string
  interested_in: string
}

interface DirectoryFiltersProps {
  filters: Filters
  onChange: (filters: Filters) => void
  majors?: string[]
  greekLife?: string[]
  clubs?: string[]
  residenceHalls?: { value: string; label: string; group?: string }[]
  hasCourses?: boolean
}

export default function DirectoryFilters({ filters, onChange, majors = [], greekLife = [], clubs = [], residenceHalls = [], hasCourses = false }: DirectoryFiltersProps) {
  const [showMore, setShowMore] = useState(false)

  const update = (key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value })
  }

  const hasFilters = Object.values(filters).some(v => v !== '')
  const moreCount = [filters.gender, filters.hometown, filters.high_school, filters.fraternity_sorority, filters.clubs, filters.relationship_status, filters.interested_in, filters.course].filter(Boolean).length

  return (
    <div className="space-y-3">
      {/* Name search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
        <input
          type="text"
          value={filters.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Search by name..."
          className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-[14px] placeholder:text-text-muted/50 outline-none focus:border-text-muted transition-colors"
        />
      </div>

      {/* Primary filters — always visible */}
      <div className="grid grid-cols-2 gap-2">
        {residenceHalls.length > 0 && (
          <div>
            <label className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5 block">Residence Hall</label>
            <StyledSelect
              value={filters.residence_hall}
              onChange={(v) => update('residence_hall', v)}
              placeholder="Any hall"
              searchable
              options={residenceHalls}
            />
          </div>
        )}
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5 block">Major</label>
          <StyledSelect
            value={filters.major}
            onChange={(v) => update('major', v)}
            placeholder="Any major"
            searchable
            options={majors.map(m => ({ value: m, label: m }))}
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5 block">Class Year</label>
          <StyledSelect
            value={filters.class_year}
            onChange={(v) => update('class_year', v)}
            placeholder="Any"
            options={CLASS_YEARS.map(y => ({ value: y.toString(), label: y.toString() }))}
          />
        </div>
      </div>

      {/* More filters toggle */}
      <button
        onClick={() => setShowMore(!showMore)}
        className="press flex items-center gap-1 text-[12px] text-text-muted hover:text-text font-medium"
      >
        {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        More filters{moreCount > 0 && ` (${moreCount} active)`}
      </button>

      {/* Extra filters — collapsible */}
      {showMore && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5 block">Gender</label>
              <StyledSelect
                value={filters.gender}
                onChange={(v) => update('gender', v)}
                placeholder="Any"
                options={GENDERS.map(g => ({ value: g, label: g }))}
              />
            </div>
            {greekLife.length > 0 && (
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5 block">Greek Life</label>
                <StyledSelect
                  value={filters.fraternity_sorority}
                  onChange={(v) => update('fraternity_sorority', v)}
                  placeholder="Any"
                  searchable
                  options={greekLife.map(g => ({ value: g, label: g }))}
                />
              </div>
            )}
            {clubs.length > 0 && (
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5 block">Club</label>
                <StyledSelect
                  value={filters.clubs}
                  onChange={(v) => update('clubs', v)}
                  placeholder="Any"
                  searchable
                  options={clubs.map(c => ({ value: c, label: c }))}
                />
              </div>
            )}
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5 block">Relationship</label>
              <StyledSelect
                value={filters.relationship_status}
                onChange={(v) => update('relationship_status', v)}
                placeholder="Any"
                options={RELATIONSHIP_STATUSES.map(s => ({ value: s, label: s }))}
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5 block">Interested In</label>
              <StyledSelect
                value={filters.interested_in}
                onChange={(v) => update('interested_in', v)}
                placeholder="Any"
                options={INTERESTED_IN.map(s => ({ value: s, label: s }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {hasCourses && (
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5 block">Course</label>
                <input
                  type="text"
                  value={filters.course}
                  onChange={(e) => update('course', e.target.value.toUpperCase())}
                  placeholder="e.g. CSE 214"
                  className="w-full bg-bg-card border border-border rounded-xl px-3 py-2 text-[13px] placeholder:text-text-muted/50 outline-none focus:border-text-muted transition-colors"
                />
              </div>
            )}
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5 block">Hometown</label>
              <input
                type="text"
                value={filters.hometown}
                onChange={(e) => update('hometown', e.target.value)}
                placeholder="Any"
                className="w-full bg-bg-card border border-border rounded-xl px-3 py-2 text-[13px] placeholder:text-text-muted/50 outline-none focus:border-text-muted transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5 block">High School</label>
              <input
                type="text"
                value={filters.high_school}
                onChange={(e) => update('high_school', e.target.value)}
                placeholder="Any"
                className="w-full bg-bg-card border border-border rounded-xl px-3 py-2 text-[13px] placeholder:text-text-muted/50 outline-none focus:border-text-muted transition-colors"
              />
            </div>
          </div>
        </>
      )}

      {hasFilters && (
        <button
          onClick={() => onChange({
            name: '', residence_hall: '', course: '', gender: '', major: '', class_year: '',
            hometown: '', high_school: '', fraternity_sorority: '', clubs: '',
            relationship_status: '', interested_in: '',
          })}
          className="text-[12px] text-text-muted flex items-center gap-1 press hover:text-text"
        >
          <X size={12} /> Clear all filters
        </button>
      )}
    </div>
  )
}
