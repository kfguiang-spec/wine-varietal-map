export type OivCountry = { country: string; ha: number }

export type OivVariety = {
  id: string
  name: string
  color: string
  wine: boolean
  unit: string
  year: number
  world_total_ha: number
  reported_sum_ha: number
  countries: OivCountry[]
}

export type OivFile = {
  source: {
    citation: string
    url: string
    year: number
    unit: string
    coverage_note: string
  }
  varieties: OivVariety[]
}

export type CaCountyRow = {
  county: string
  acres: number
  region_id: string
}

export type CaRegionRow = {
  region_id: string
  acres: number
}

export type CaVariety = {
  id: string
  usda_name: string
  unit: string
  year: number
  state_total_acres: number | null
  counties: CaCountyRow[]
  regions: CaRegionRow[]
}

export type CaFile = {
  source: {
    citation: string
    url: string
    year: number
    unit: string
  }
  varieties: CaVariety[]
}

export type ClimateRegion = {
  id: string
  name?: string
  station: string
  kind?: string | null
  note?: string | null
  annual_mean_c: number | null
  growing_season_mean_c: number | null
  growing_season_months?: string
}

export type ClimateFile = {
  source: string
  citation: string
  methodology: string
  regions: ClimateRegion[]
}

export type RegionMeta = {
  id: string
  name: string
  lat: number
  lon: number
  station: string
  note: string
}

export type Concordance = {
  methodology: string
  county_to_region: Record<string, string>
  regions: RegionMeta[]
  country_name_to_climate_id: Record<string, string>
}
