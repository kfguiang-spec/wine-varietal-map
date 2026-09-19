import type { OivVariety } from '../lib/types'
import { formatHa } from '../lib/format'

type Props = {
  varieties: OivVariety[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function VarietyList({ varieties, selectedId, onSelect }: Props) {
  const ranked = [...varieties].sort((a, b) => b.world_total_ha - a.world_total_ha)
  return (
    <nav className="sidebar" aria-label="Varietals by world planted area">
      <div className="muted" style={{ padding: '0.25rem 1rem 0.5rem' }}>
        Ranked by OIV world total (ha, ~2015)
      </div>
      {ranked.map((v) => (
        <button
          key={v.id}
          type="button"
          className={`variety-row${selectedId === v.id ? ' active' : ''}`}
          onClick={() => onSelect(v.id)}
          aria-pressed={selectedId === v.id}
        >
          <span>{v.name}</span>
          <span className="ha">{formatHa(v.world_total_ha)} ha</span>
        </button>
      ))}
    </nav>
  )
}
