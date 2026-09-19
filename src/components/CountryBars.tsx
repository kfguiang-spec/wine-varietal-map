import { formatHa, pct } from '../lib/format'
import type { OivCountry } from '../lib/types'

type Props = {
  countries: OivCountry[]
  worldTotal: number
  selected: Set<string>
  onToggle: (country: string) => void
  maxSelect: number
}

export function CountryBars({ countries, worldTotal, selected, onToggle, maxSelect }: Props) {
  const top = countries.filter((c) => c.country !== 'Other').slice(0, 18)
  const maxHa = top[0]?.ha ?? 1
  return (
    <div className="bar-list" role="list">
      {top.map((c) => {
        const isOn = selected.has(c.country)
        const canToggle = isOn || selected.size < maxSelect
        return (
          <div key={c.country} className={`bar-row${isOn ? ' selected' : ''}`} role="listitem">
            <button
              type="button"
              className="pick"
              disabled={!canToggle}
              onClick={() => onToggle(c.country)}
              title={isOn ? 'Remove from compare' : 'Add to compare (max 3)'}
            >
              {c.country}
              {isOn ? ' ✓' : ''}
            </button>
            <div className="bar-track" aria-hidden>
              <div className="bar-fill" style={{ width: `${(100 * c.ha) / maxHa}%` }} />
            </div>
            <span className="bar-meta">
              {formatHa(c.ha)} ha · {pct(c.ha, worldTotal)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
