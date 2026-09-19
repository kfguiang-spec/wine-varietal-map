/**
 * Seed climate.json from sibling wine projects where IDs/stations overlap,
 * then fetch only missing Open-Meteo ERA5 points.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const workspace = join(root, '..')
const locations = JSON.parse(readFileSync(join(root, 'src/data/climate-locations.json'), 'utf8'))

const START = '1991-01-01'
const END = '2020-12-31'
const MODEL = 'era5'

function mean(arr) {
  const vals = arr.filter((v) => v != null && !Number.isNaN(v))
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}
function round1(n) {
  return n == null ? null : Math.round(n * 10) / 10
}

function summarize(region, data) {
  const times = data.daily.time
  const temps = data.daily.temperature_2m_mean
  const growing = []
  for (let i = 0; i < times.length; i++) {
    const month = Number(times[i].slice(5, 7))
    if (month >= 4 && month <= 10) growing.push(temps[i])
  }
  return {
    id: region.id,
    name: region.name,
    station: region.station,
    kind: region.kind || null,
    note: region.note || null,
    requested: { lat: region.lat, lon: region.lon },
    grid: {
      latitude: data.latitude,
      longitude: data.longitude,
      elevation_m: data.elevation,
    },
    period: { start: START, end: END },
    model: MODEL,
    units: '°C',
    annual_mean_c: round1(mean(temps)),
    growing_season_mean_c: round1(mean(growing)),
    growing_season_months: 'Apr–Oct',
    sample_days: times.length,
    growing_season_days: growing.length,
  }
}

async function fetchOne(region) {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', String(region.lat))
  url.searchParams.set('longitude', String(region.lon))
  url.searchParams.set('start_date', START)
  url.searchParams.set('end_date', END)
  url.searchParams.set('daily', 'temperature_2m_mean')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('models', MODEL)
  console.log(`Fetching ${region.id} (${region.station})...`)
  const res = await fetch(url)
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`${region.id}: non-JSON ${res.status} ${text.slice(0, 120)}`)
  }
  if (!res.ok || data.error) {
    const err = new Error(`${region.id}: HTTP ${res.status} ${data.reason || text.slice(0, 200)}`)
    err.status = res.status
    throw err
  }
  return summarize(region, data)
}

async function fetchWithRetry(region) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      return await fetchOne(region)
    } catch (e) {
      const wait = e.status === 429 ? 70000 : 4000 * attempt
      console.warn(`  attempt ${attempt} failed: ${e.message}; waiting ${Math.round(wait / 1000)}s`)
      if (attempt === 8) throw e
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

function remap(src, newId, loc) {
  return {
    ...src,
    id: newId,
    name: loc.name,
    station: loc.station,
    kind: loc.kind || null,
    note: loc.note || null,
    requested: { lat: loc.lat, lon: loc.lon },
    seeded_from: src.id,
  }
}

function loadSibling(rel) {
  const p = join(workspace, rel)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8'))
}

async function main() {
  const us = loadSibling('us-wine-regions/public/data/climate.json')
  const fr = loadSibling('french-wine-regions/public/data/climate.json')
  const usById = new Map((us?.regions || []).map((r) => [r.id, r]))
  const frById = new Map((fr?.regions || []).map((r) => [r.id, r]))

  const outPath = join(root, 'public/data/climate.json')
  let existing = { regions: [] }
  try {
    existing = JSON.parse(readFileSync(outPath, 'utf8'))
  } catch {
    /* */
  }
  const byId = new Map((existing.regions || []).map((r) => [r.id, r]))

  // Seed maps: our id -> sibling id
  const seedMap = {
    napa: ['napa'],
    sonoma: ['sonoma'],
    'paso-robles': ['paso-robles'],
    'santa-barbara': ['santa-barbara'],
    lodi: ['lodi'],
    monterey: ['monterey'],
    mendocino: ['mendocino'],
    'sierra-foothills': ['sierra-foothills'],
    usa: ['napa'],
    france: null, // from FR bordeaux
  }

  for (const loc of locations) {
    if (byId.has(loc.id) && byId.get(loc.id).annual_mean_c != null) continue
    if (loc.id === 'france' && frById.has('bordeaux')) {
      byId.set(loc.id, remap(frById.get('bordeaux'), 'france', loc))
      console.log('Seeded france from french-wine-regions bordeaux')
      continue
    }
    const keys = seedMap[loc.id]
    if (keys) {
      for (const k of keys) {
        if (usById.has(k)) {
          byId.set(loc.id, remap(usById.get(k), loc.id, loc))
          console.log(`Seeded ${loc.id} from us-wine-regions ${k}`)
          break
        }
      }
    }
  }

  const results = []
  for (const loc of locations) {
    if (byId.has(loc.id) && byId.get(loc.id).annual_mean_c != null) {
      console.log(`Keeping ${loc.id}`)
      results.push(byId.get(loc.id))
      continue
    }
    const row = await fetchWithRetry(loc)
    results.push(row)
    byId.set(loc.id, row)
    // persist incrementally
    const out = {
      fetched_at: new Date().toISOString(),
      source:
        'Open-Meteo Historical Weather API (ERA5 reanalysis). Daily temperature_2m_mean averaged over 1991–2020. Some CA/France points seeded from sibling project climate.json (same methodology).',
      attribution: 'https://open-meteo.com/',
      citation:
        'Hersbach et al. (2023). ERA5 hourly data on single levels from 1940 to present. ECMWF. https://doi.org/10.24381/cds.adbb2d47 — via Open-Meteo.',
      methodology:
        'For each representative station coordinate, daily 2 m mean air temperature (ERA5) was requested for 1991-01-01 through 2020-12-31. Annual mean = average of all daily means. Growing-season mean = average of daily means where month is April through October (inclusive). Values rounded to 0.1 °C.',
      regions: [...byId.values()],
    }
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
    await new Promise((r) => setTimeout(r, 12000))
  }

  const out = {
    fetched_at: new Date().toISOString(),
    source:
      'Open-Meteo Historical Weather API (ERA5 reanalysis). Daily temperature_2m_mean averaged over 1991–2020. Some CA/France points seeded from sibling project climate.json (same methodology).',
    attribution: 'https://open-meteo.com/',
    citation:
      'Hersbach et al. (2023). ERA5 hourly data on single levels from 1940 to present. ECMWF. https://doi.org/10.24381/cds.adbb2d47 — via Open-Meteo.',
    methodology:
      'For each representative station coordinate, daily 2 m mean air temperature (ERA5) was requested for 1991-01-01 through 2020-12-31. Annual mean = average of all daily means. Growing-season mean = average of daily means where month is April through October (inclusive). Values rounded to 0.1 °C. Same methodology as french-wine-regions / us-wine-regions.',
    regions: results,
  }
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
  console.log(`Wrote ${outPath} (${results.length} locations)`)
  for (const r of results) {
    console.log(
      `  ${r.id.padEnd(22)} ann=${r.annual_mean_c}°C  grow=${r.growing_season_mean_c}°C`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
