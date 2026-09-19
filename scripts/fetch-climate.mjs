/**
 * Pre-fetch Open-Meteo Historical Weather (ERA5) daily means for compare points.
 * Same methodology as french-wine-regions / us-wine-regions.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const locations = JSON.parse(readFileSync(join(root, 'src/data/climate-locations.json'), 'utf8'))

const START = '1991-01-01'
const END = '2020-12-31'
const MODEL = 'era5'
const SOURCE =
  'Open-Meteo Historical Weather API (ERA5 reanalysis). Daily temperature_2m_mean averaged over 1991–2020.'

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
    const reason = data.reason || text.slice(0, 200)
    const err = new Error(`${region.id}: HTTP ${res.status} ${reason}`)
    err.status = res.status
    throw err
  }
  return summarize(region, data)
}

async function fetchWithRetry(region) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      return await fetchOne(region)
    } catch (e) {
      const wait = e.status === 429 ? 65000 : 3000 * attempt
      console.warn(`  attempt ${attempt} failed: ${e.message}; waiting ${Math.round(wait / 1000)}s`)
      if (attempt === 6) throw e
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

async function main() {
  const outPath = join(root, 'public/data/climate.json')
  let existing = { regions: [] }
  try {
    existing = JSON.parse(readFileSync(outPath, 'utf8'))
  } catch {
    /* fresh */
  }
  const byId = new Map((existing.regions || []).map((r) => [r.id, r]))

  const results = []
  for (const region of locations) {
    if (byId.has(region.id) && byId.get(region.id).annual_mean_c != null) {
      console.log(`Keeping cached ${region.id}`)
      results.push(byId.get(region.id))
      continue
    }
    results.push(await fetchWithRetry(region))
    await new Promise((r) => setTimeout(r, 8000))
  }

  const out = {
    fetched_at: new Date().toISOString(),
    source: SOURCE,
    attribution: 'https://open-meteo.com/',
    citation:
      'Hersbach et al. (2023). ERA5 hourly data on single levels from 1940 to present. ECMWF. https://doi.org/10.24381/cds.adbb2d47 — via Open-Meteo.',
    methodology:
      'For each representative station coordinate, daily 2 m mean air temperature (ERA5) was requested for 1991-01-01 through 2020-12-31. Annual mean = average of all daily means. Growing-season mean = average of daily means where month is April through October (inclusive). Values rounded to 0.1 °C. Same methodology as french-wine-regions / us-wine-regions.',
    regions: results,
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
  console.log(`Wrote ${outPath} (${results.length} locations)`)
  for (const r of results) {
    console.log(
      `  ${r.id.padEnd(22)} ann=${r.annual_mean_c}°C  grow=${r.growing_season_mean_c}°C  (${r.station})`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
