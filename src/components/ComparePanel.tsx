import { formatHa, formatAcres, pct } from '../lib/format'
import { formatTemp, type TempUnit } from '../lib/tempScale'
import type { ClimateRegion } from '../lib/types'

export type CompareItem = {
  key: string
  title: string
  areaLabel: string
  areaValue: number
  areaUnit: 'ha' | 'acres'
  shareOf?: number
  climate: ClimateRegion | null
  note?: string | null
}

type Props = {
  items: CompareItem[]
  unit: TempUnit
  onRemove: (key: string) => void
}

export function ComparePanel({ items, unit, onRemove }: Props) {
  if (!items.length) {
    return (
      <p className="muted">
        Select 2–3 countries (or CA regions below) to compare planted area and climate normals.
      </p>
    )
  }
  return (
    <>
      <div className="compare-picks">
        {items.map((it) => (
          <span key={it.key} className="chip">
            {it.title}
            <button type="button" aria-label={`Remove ${it.title}`} onClick={() => onRemove(it.key)}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="compare-grid">
        {items.map((it) => (
          <article key={it.key} className="compare-card">
            <h4>{it.title}</h4>
            <dl>
              <dt>{it.areaLabel}</dt>
              <dd>
                {it.areaUnit === 'ha' ? formatHa(it.areaValue) : formatAcres(it.areaValue)}{' '}
                {it.areaUnit}
                {it.shareOf != null ? ` (${pct(it.areaValue, it.shareOf)})` : ''}
              </dd>
              <dt>Annual mean</dt>
              <dd>{formatTemp(it.climate?.annual_mean_c, unit)}</dd>
              <dt>Growing season</dt>
              <dd>
                {formatTemp(it.climate?.growing_season_mean_c, unit)}
                <span className="muted">
                  {' '}
                  · {it.climate?.growing_season_months ?? 'Apr–Oct'}
                </span>
              </dd>
              <dt>Station</dt>
              <dd>{it.climate?.station ?? '—'}</dd>
            </dl>
            {it.note ? <p className="note">{it.note}</p> : null}
          </article>
        ))}
      </div>
    </>
  )
}
