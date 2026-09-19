import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const locations = JSON.parse(readFileSync(join(root, 'src/data/climate-locations.json'), 'utf8'))
const outPath = join(root, 'public/data/climate.json')
const START = '1991-01-01'
const END = '2020-12-31'

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
    grid: { latitude: data.latitude, longitude: data.longitude, elevation_m: data.elevation },
    period: { start: START, end: END },
    model: 'era5',
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
  url.searchParams.set('models', 'era5')
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok || data.error) {
    const err = new Error(`${region.id}: HTTP ${res.status} ${data.reason || ''}`)
    err.status = res.status
    throw err
  }
  return summarize(region, data)
}

function save(byId, meta) {
  const regions = locations.map((l) => byId.get(l.id)).filter(Boolean)
  const pending = locations.filter((l) => !byId.has(l.id)).map((l) => l.id)
  const out = {
    ...meta,
    fetched_at: new Date().toISOString(),
    pending_ids: pending,
    regions,
  }
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
  console.log(`saved ${regions.length}/${locations.length}; pending ${pending.length}`)
}

async function main() {
  const waitMin = Number(process.env.CLIMATE_WAIT_MIN || '50')
  if (waitMin > 0) {
    console.log(`Waiting ${waitMin} minutes for Open-Meteo hourly quota...`)
    await new Promise((r) => setTimeout(r, waitMin * 60 * 1000))
  }
  let existing = JSON.parse(readFileSync(outPath, 'utf8'))
  const byId = new Map(existing.regions.map((r) => [r.id, r]))
  const meta = {
    source: existing.source,
    attribution: existing.attribution,
    citation: existing.citation,
    methodology: existing.methodology,
  }
  for (const loc of locations) {
    if (byId.has(loc.id) && byId.get(loc.id).annual_mean_c != null) {
      console.log('skip', loc.id)
      continue
    }
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        console.log('fetch', loc.id)
        const row = await fetchOne(loc)
        byId.set(loc.id, row)
        save(byId, meta)
        break
      } catch (e) {
        const wait = e.status === 429 ? 70000 : 5000 * attempt
        console.warn(`  fail ${attempt}: ${e.message}; wait ${Math.round(wait / 1000)}s`)
        if (attempt === 10) throw e
        await new Promise((r) => setTimeout(r, wait))
      }
    }
    await new Promise((r) => setTimeout(r, 10000))
  }
  console.log('done')
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
