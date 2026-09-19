import { useEffect, useMemo, useState } from 'react'
import concordance from './data/ca-county-regions.json'
import { CaliforniaDrill } from './components/CaliforniaDrill'
import { ComparePanel, type CompareItem } from './components/ComparePanel'
import { CountryBars } from './components/CountryBars'
import { VarietyList } from './components/VarietyList'
import type { TempUnit } from './lib/tempScale'
import type {
  CaFile,
  CaVariety,
  ClimateFile,
  Concordance,
  OivFile,
  OivVariety,
  RegionMeta,
} from './lib/types'

const CONCORD = concordance as Concordance
const REGION_META = new Map<string, RegionMeta>(CONCORD.regions.map((r) => [r.id, r]))
const MAX_COMPARE = 3

const RELATED = [
  { href: 'https://kfguiang-spec.github.io/french-wine-regions/', label: 'French wine regions' },
  { href: 'https://kfguiang-spec.github.io/us-wine-regions/', label: 'US wine regions' },
  { href: 'https://kfguiang-spec.github.io/grape-lineage/', label: 'Grape lineage' },
  { href: 'https://kfguiang-spec.github.io/wset-tasting-guide/', label: 'WSET tasting guide' },
]

function countryClimateId(country: string): string | undefined {
  return CONCORD.country_name_to_climate_id[country]
}

export default function App() {
  const [oiv, setOiv] = useState<OivFile | null>(null)
  const [ca, setCa] = useState<CaFile | null>(null)
  const [climate, setClimate] = useState<ClimateFile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [varietyId, setVarietyId] = useState<string | null>('cabernet-sauvignon')
  const [unit, setUnit] = useState<TempUnit>('F')
  const [pickedCountries, setPickedCountries] = useState<string[]>(['France', 'USA', 'Chile'])
  const [pickedCaRegions, setPickedCaRegions] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const base = import.meta.env.BASE_URL
        const [oRes, cRes, clRes] = await Promise.all([
          fetch(`${base}data/oiv-varieties.json`),
          fetch(`${base}data/ca-variety-counties.json`),
          fetch(`${base}data/climate.json`),
        ])
        if (!oRes.ok) throw new Error(`Failed to load oiv-varieties.json (${oRes.status})`)
        if (!cRes.ok) throw new Error(`Failed to load ca-variety-counties.json (${cRes.status})`)
        if (!clRes.ok) throw new Error(`Failed to load climate.json (${clRes.status})`)
        const oData = (await oRes.json()) as OivFile
        const cData = (await cRes.json()) as CaFile
        const clData = (await clRes.json()) as ClimateFile
        if (!cancelled) {
          setOiv(oData)
          setCa(cData)
          setClimate(clData)
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const climateById = useMemo(() => {
    return new Map(climate?.regions.map((r) => [r.id, r]) ?? [])
  }, [climate])

  const variety: OivVariety | null = useMemo(() => {
    if (!oiv || !varietyId) return null
    return oiv.varieties.find((v) => v.id === varietyId) ?? null
  }, [oiv, varietyId])

  const caVariety: CaVariety | null = useMemo(() => {
    if (!ca || !varietyId) return null
    // Direct id match, or USDA name heuristics
    const direct = ca.varieties.find((v) => v.id === varietyId)
    if (direct) return direct
    if (varietyId === 'grenache-noir') {
      return ca.varieties.find((v) => v.id === 'grenache-noir' || v.usda_name === 'GRENACHE') ?? null
    }
    if (varietyId === 'zinfandel-primitivo') {
      return ca.varieties.find((v) => v.usda_name === 'ZINFANDEL') ?? null
    }
    if (varietyId === 'syrah') {
      return ca.varieties.find((v) => v.usda_name === 'SYRAH') ?? null
    }
    return null
  }, [ca, varietyId])

  useEffect(() => {
    if (!oiv || !varietyId) return
    const v = oiv.varieties.find((x) => x.id === varietyId)
    if (!v) return
    const names = new Set(v.countries.map((c) => c.country))
    const defaults = ['France', 'USA', 'Chile', 'Spain', 'Italy', 'Australia', 'China'].filter(
      (c) => names.has(c),
    )
    setPickedCountries(defaults.slice(0, MAX_COMPARE))
    setPickedCaRegions([])
  }, [varietyId, oiv])

  const countrySelected = useMemo(() => new Set(pickedCountries), [pickedCountries])
  const caSelected = useMemo(() => new Set(pickedCaRegions), [pickedCaRegions])

  function toggleCountry(country: string) {
    setPickedCountries((prev) => {
      if (prev.includes(country)) return prev.filter((c) => c !== country)
      if (prev.length >= MAX_COMPARE) return prev
      // Prefer clearing CA picks when mixing? Allow both but cap total display at 3
      const room = MAX_COMPARE - Math.min(pickedCaRegions.length, MAX_COMPARE)
      if (prev.length >= room && pickedCaRegions.length) {
        setPickedCaRegions([])
      }
      return [...prev, country].slice(0, MAX_COMPARE)
    })
  }

  function toggleCaRegion(regionId: string) {
    setPickedCaRegions((prev) => {
      if (prev.includes(regionId)) return prev.filter((r) => r !== regionId)
      if (prev.length >= MAX_COMPARE) return prev
      setPickedCountries([])
      return [...prev, regionId].slice(0, MAX_COMPARE)
    })
  }

  const compareItems: CompareItem[] = useMemo(() => {
    const items: CompareItem[] = []
    if (variety) {
      for (const country of pickedCountries) {
        const row = variety.countries.find((c) => c.country === country)
        if (!row) continue
        const cid = countryClimateId(country)
        const cl = cid ? climateById.get(cid) ?? null : null
        items.push({
          key: `country:${country}`,
          title: country,
          areaLabel: `OIV planted area (${variety.year})`,
          areaValue: row.ha,
          areaUnit: 'ha',
          shareOf: variety.world_total_ha,
          climate: cl,
          note: cl?.note ?? null,
        })
      }
    }
    if (caVariety) {
      const total = caVariety.state_total_acres ?? 0
      for (const rid of pickedCaRegions) {
        const row = caVariety.regions.find((r) => r.region_id === rid)
        const meta = REGION_META.get(rid)
        if (!row || !meta) continue
        const cl = climateById.get(rid) ?? null
        items.push({
          key: `ca:${rid}`,
          title: meta.name,
          areaLabel: `CA standing acres (${caVariety.year})`,
          areaValue: row.acres,
          areaUnit: 'acres',
          shareOf: total || undefined,
          climate: cl,
          note: meta.note,
        })
      }
    }
    return items
  }, [variety, caVariety, pickedCountries, pickedCaRegions, climateById])

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <h1>Wine varietal map</h1>
          <p className="tagline">
            Production reality · planted area by varietal · climate compare
          </p>
        </div>
        <div className="toolbar">
          <span className="muted">Temperature</span>
          <button
            type="button"
            className={unit === 'F' ? 'active' : ''}
            onClick={() => setUnit('F')}
          >
            °F
          </button>
          <button
            type="button"
            className={unit === 'C' ? 'active' : ''}
            onClick={() => setUnit('C')}
          >
            °C
          </button>
          <span className="spacer" />
          <span className="muted">Scout where grapes grow at scale — not brand hype.</span>
        </div>
        <p className="caveat">
          <strong>Caveat:</strong> planted area ≠ bottle quality or price. This tool shows where a
          grape is grown (OIV ha by country; USDA acres by California county/region) and
          representative climate normals so you can compare famous brands with high-volume or
          lesser-known zones. No retail prices or markup estimates.
        </p>
      </header>

      {loading ? <div className="status">Loading data…</div> : null}
      {loadError ? <div className="status error">{loadError}</div> : null}

      {!loading && !loadError && oiv ? (
        <div className="main">
          <VarietyList
            varieties={oiv.varieties}
            selectedId={varietyId}
            onSelect={(id) => setVarietyId(id)}
          />
          <div className="panel">
            {variety ? (
              <>
                <h2 className="section-title">{variety.name}</h2>
                <p className="muted">
                  World total (OIV tables, {variety.year}):{' '}
                  <strong>{Math.round(variety.world_total_ha).toLocaleString('en-US')} ha</strong>
                  . Click a country to add/remove from compare (max {MAX_COMPARE}).
                </p>

                <h3 className="subhead">Top countries by planted area</h3>
                <CountryBars
                  countries={variety.countries}
                  worldTotal={variety.world_total_ha}
                  selected={countrySelected}
                  onToggle={toggleCountry}
                  maxSelect={MAX_COMPARE}
                />

                <h3 className="subhead">Region compare</h3>
                <ComparePanel
                  items={compareItems}
                  unit={unit}
                  onRemove={(key) => {
                    if (key.startsWith('country:')) {
                      setPickedCountries((p) => p.filter((c) => `country:${c}` !== key))
                    } else if (key.startsWith('ca:')) {
                      setPickedCaRegions((p) => p.filter((r) => `ca:${r}` !== key))
                    }
                  }}
                />

                <h3 className="subhead">California drill-down</h3>
                <CaliforniaDrill
                  ca={caVariety}
                  regionMeta={REGION_META}
                  selectedRegions={caSelected}
                  onToggleRegion={toggleCaRegion}
                  maxSelect={MAX_COMPARE}
                />

                <nav className="links" aria-label="Related guides">
                  {RELATED.map((l) => (
                    <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  ))}
                </nav>
              </>
            ) : (
              <p className="muted">Select a varietal.</p>
            )}
          </div>
        </div>
      ) : null}

      <footer className="footer">
        Sources: OIV Grapevine Varieties’ Area by Country (2015 tables) · USDA NASS California Grape
        Acreage Report (2025 crop) · Open-Meteo ERA5 1991–2020. See README for methodology.
        {oiv ? ` · ${oiv.source.citation.slice(0, 80)}…` : ''}
      </footer>
    </div>
  )
}
