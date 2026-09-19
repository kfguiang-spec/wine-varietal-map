import { formatAcres, pct, acresToHa } from '../lib/format'
import type { CaVariety, RegionMeta } from '../lib/types'

type Props = {
  ca: CaVariety | null
  regionMeta: Map<string, RegionMeta>
  selectedRegions: Set<string>
  onToggleRegion: (regionId: string) => void
  maxSelect: number
}

export function CaliforniaDrill({
  ca,
  regionMeta,
  selectedRegions,
  onToggleRegion,
  maxSelect,
}: Props) {
  if (!ca) {
    return (
      <p className="muted">
        No USDA California county breakdown for this varietal in the extracted tables (or name
        mismatch). Try Cabernet Sauvignon, Chardonnay, Pinot Noir, Zinfandel, etc.
      </p>
    )
  }

  const total = ca.state_total_acres ?? ca.counties.reduce((s, c) => s + c.acres, 0)
  const maxAc = ca.regions[0]?.acres ?? 1

  return (
    <div>
      <p className="muted">
        California standing acres (USDA NASS {ca.year} crop):{' '}
        <strong>{formatAcres(total)} acres</strong>
        {total ? ` ≈ ${formatAcres(acresToHa(total))} ha` : ''}. County → region concordance is
        explicit (not AVA legal boundaries).
      </p>

      <h3 className="subhead">By wine region (rolled up)</h3>
      <div className="bar-list">
        {ca.regions.map((r) => {
          const meta = regionMeta.get(r.region_id)
          const label = meta?.name ?? r.region_id
          const isOn = selectedRegions.has(r.region_id)
          const canToggle = isOn || selectedRegions.size < maxSelect
          return (
            <div key={r.region_id} className={`bar-row${isOn ? ' selected' : ''}`}>
              <button
                type="button"
                className="pick"
                disabled={!canToggle}
                onClick={() => onToggleRegion(r.region_id)}
              >
                {label}
                {isOn ? ' ✓' : ''}
              </button>
              <div className="bar-track" aria-hidden>
                <div className="bar-fill" style={{ width: `${(100 * r.acres) / maxAc}%` }} />
              </div>
              <span className="bar-meta">
                {formatAcres(r.acres)} ac · {pct(r.acres, total)}
              </span>
            </div>
          )
        })}
      </div>

      <h3 className="subhead">Top counties</h3>
      <table className="data">
        <thead>
          <tr>
            <th>County</th>
            <th>Region</th>
            <th className="num">Acres</th>
            <th className="num">Share</th>
          </tr>
        </thead>
        <tbody>
          {ca.counties.slice(0, 20).map((c) => (
            <tr key={c.county}>
              <td>{c.county}</td>
              <td>{regionMeta.get(c.region_id)?.name ?? c.region_id}</td>
              <td className="num">{formatAcres(c.acres)}</td>
              <td className="num">{pct(c.acres, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
