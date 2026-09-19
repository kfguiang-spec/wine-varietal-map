# Wine varietal map

Scout wine regions by **production reality** (planted / bearing area), not brand hype.

1. Pick a **varietal** (ranked by OIV world hectares)
2. See **planted area by country**
3. **Compare** 2–3 regions (area + Open-Meteo climate normals)
4. **California drill-down**: USDA county acres rolled up to wine regions

**Live:** https://kfguiang-spec.github.io/wine-varietal-map/

**Caveat:** planted area ≠ bottle quality or price. This app does **not** invent retail prices or markup percentages.

## Stack

Vite + React + TypeScript. GitHub Pages via `gh-pages` branch with `VITE_BASE=/wine-varietal-map/`.

```bash
npm install
npm run fetch:climate   # once (writes public/data/climate.json)
npm run dev
npm run build           # must succeed
npm run deploy          # build:pages + push gh-pages
```

## Data sources (cited; no fabricated figures)

### Global / by country — OIV

- **OIV (2017).** *Grapevine Varieties’ Area by Country, 2015* (tables for Focus: Distribution of the world’s grapevine varieties).
  - PDF: https://www.oiv.int/public/medias/5851/grapevine-varieties-area-by-country-2015-focus-oiv-2017.pdf
  - Focus narrative: https://www.oiv.int/sites/default/files/2022-09/en-distribution-of-the-worlds-grapevine-varieties-2017.pdf
- Extracted into `public/data/oiv-varieties.json` with `source`, `year: 2015`, `unit: ha`.
- Coverage ~75% of world vineyard; more representative of wine grapes than table/dried grapes.
- Rebuild: `node scripts/build-oiv-json.mjs`

**University of Adelaide / Anderson & Nelgen** bearing-area Excel was **not** redistributed here (license/terms unclear for derived JSON). Stick to OIV + USDA.

### California — USDA NASS

- **USDA NASS California Field Office.** *California Grape Acreage Report, 2025 Crop* (Excel tables 6–7: white/red wine grapes by variety and county).
  - Listing: https://www.nass.usda.gov/Statistics_by_State/California/Publications/Specialty_and_Other_Releases/Grapes/Acreage/
  - File used: `2025GrapeAcreageExcel.zip` → `202604gabtb06.xlsx`, `202604gabtb07.xlsx`
- Extracted into `public/data/ca-variety-counties.json` (`unit: acres`, standing acreage totals).
- County → wine region concordance: `src/data/ca-county-regions.json` (explicit PoC mapping; **not** legal AVA boundaries). Example: San Luis Obispo → Paso Robles; San Joaquin + Sacramento → Lodi/Delta.
- Rebuild: `.venv/bin/python scripts/build-usda-json.py` (requires `openpyxl` in `.venv`)

### Climate — Open-Meteo ERA5

Same methodology as [french-wine-regions](https://github.com/kfguiang-spec/french-wine-regions) / [us-wine-regions](https://github.com/kfguiang-spec/us-wine-regions):

- Daily `temperature_2m_mean` for **1991-01-01 … 2020-12-31**, model `era5`
- **Annual mean** = mean of all daily means
- **Growing-season mean** = mean of daily means for months **April–October**
- Stored in °C in `public/data/climate.json`; UI defaults to °F
- Representative points for countries (e.g. Bordeaux, Napa, Maipo, Ningxia) and CA regions

## Limitations

- OIV figures are **~2015**; plantings have changed since (esp. China, Australia, CA).
- OIV country tables omit blank cells; “Other” rows are as published.
- USA OIV hectares are national; California USDA acres are a subset and use a different year/unit — do not treat them as the same series.
- County→region rollups are a **concordance for UI**, not AVA acreage.
- Climate is a **single grid point** per region — not a vineyard mean or degree-day model.
- Area does not imply yield, quality, or price.

## Related

- https://kfguiang-spec.github.io/french-wine-regions/
- https://kfguiang-spec.github.io/us-wine-regions/
- https://kfguiang-spec.github.io/grape-lineage/
- https://kfguiang-spec.github.io/wset-tasting-guide/
