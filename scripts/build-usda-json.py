#!/usr/bin/env python3
"""Extract USDA NASS CA Grape Acreage (2025 crop) variety × county standing acres → JSON."""
import json, re
from pathlib import Path
from collections import defaultdict
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "raw-data" / "usda-2025"
OUT = ROOT / "public" / "data" / "ca-variety-counties.json"
CONCORD_OUT = ROOT / "src" / "data" / "ca-county-regions.json"

TARGET = [
    "CABERNET SAUVIGNON", "MERLOT", "PINOT NOIR", "CHARDONNAY", "SAUVIGNON BLANC",
    "ZINFANDEL", "SYRAH", "PETITE SIRAH", "CABERNET FRANC", "PINOT GRIS",
    "CHENIN BLANC", "RIESLING", "GRENACHE", "TEMPRANILLO", "SANGIOVESE",
    "BARBERA", "MALBEC", "MOURVEDRE", "SEMILLON", "VIOGNIER",
    "GEWURZTRAMINER", "COLOMBARD", "RUBY CABERNET", "PINOT BLANC", "CARIGNANE",
]

# Explicit county → wine-region concordance (PoC; one primary region per county)
COUNTY_TO_REGION = {
    "Napa": "napa",
    "Sonoma": "sonoma",
    "Marin": "sonoma",
    "San Luis Obispo": "paso-robles",
    "Santa Barbara": "santa-barbara",
    "Ventura": "santa-barbara",
    "San Joaquin": "lodi",
    "Sacramento": "lodi",
    "Monterey": "monterey",
    "San Benito": "monterey",
    "Mendocino": "mendocino",
    "Lake": "lake",
    "Alameda": "livermore-bay",
    "Contra Costa": "livermore-bay",
    "Santa Clara": "livermore-bay",
    "Santa Cruz": "livermore-bay",
    "San Mateo": "livermore-bay",
    "Amador": "sierra-foothills",
    "El Dorado": "sierra-foothills",
    "Calaveras": "sierra-foothills",
    "Tuolumne": "sierra-foothills",
    "Mariposa": "sierra-foothills",
    "Fresno": "central-valley",
    "Madera": "central-valley",
    "Merced": "central-valley",
    "Kern": "central-valley",
    "Kings": "central-valley",
    "Tulare": "central-valley",
    "Stanislaus": "central-valley",
    "Yolo": "delta-yolo",
    "Solano": "delta-yolo",
    "Riverside": "southern-california",
    "San Diego": "southern-california",
    "San Bernardino": "southern-california",
    "Los Angeles": "southern-california",
    "Orange": "southern-california",
    "Tehama": "north-interior",
    "Shasta": "north-interior",
    "Butte": "north-interior",
    "Glenn": "north-interior",
    "Colusa": "north-interior",
    "Sutter": "north-interior",
    "Yuba": "north-interior",
    "Placer": "sierra-foothills",
    "Nevada": "sierra-foothills",
}

REGIONS = {
    "napa": {
        "id": "napa", "name": "Napa Valley",
        "lat": 38.5025, "lon": -122.2654, "station": "Napa",
        "note": "Highest-prestige Cabernet acreage in CA; small share of state total vs Central Valley/Paso.",
    },
    "sonoma": {
        "id": "sonoma", "name": "Sonoma County",
        "lat": 38.4021, "lon": -122.7144, "station": "Santa Rosa",
        "note": "Diverse plantings; Pinot Noir and Chardonnay strong on the coast, Cabernet inland.",
    },
    "paso-robles": {
        "id": "paso-robles", "name": "Paso Robles / SLO",
        "lat": 35.6266, "lon": -120.6910, "station": "Paso Robles",
        "note": "Mapped primarily from San Luis Obispo County; large Cabernet and Rhône acreage at scale.",
    },
    "santa-barbara": {
        "id": "santa-barbara", "name": "Santa Barbara",
        "lat": 34.6361, "lon": -120.4579, "station": "Lompoc / Santa Ynez",
        "note": "Cool-climate Pinot/Chardonnay (Sta. Rita Hills) and warmer inland valleys.",
    },
    "lodi": {
        "id": "lodi", "name": "Lodi / Delta",
        "lat": 38.1302, "lon": -121.2722, "station": "Lodi",
        "note": "High-volume Zinfandel and Cabernet from San Joaquin/Sacramento counties; value-oriented scale.",
    },
    "monterey": {
        "id": "monterey", "name": "Monterey / San Benito",
        "lat": 36.4002, "lon": -121.3227, "station": "Soledad / Salinas Valley",
        "note": "Long cool growing season; large Chardonnay and Pinot plantings.",
    },
    "mendocino": {
        "id": "mendocino", "name": "Mendocino",
        "lat": 39.1502, "lon": -123.2078, "station": "Ukiah",
        "note": "Coastal and inland valleys; notable for organics and cooler-climate reds/whites.",
    },
    "lake": {
        "id": "lake", "name": "Lake County",
        "lat": 38.9100, "lon": -122.6100, "station": "Lakeport",
        "note": "Elevated volcanic sites; significant Cabernet acreage relative to fame.",
    },
    "livermore-bay": {
        "id": "livermore-bay", "name": "SF Bay / Livermore",
        "lat": 37.6819, "lon": -121.7680, "station": "Livermore",
        "note": "Historic Bay Area vineyards; modest acreage vs Central Coast and Valley.",
    },
    "sierra-foothills": {
        "id": "sierra-foothills", "name": "Sierra Foothills",
        "lat": 38.4199, "lon": -120.8020, "station": "Amador / Placerville",
        "note": "Old-vine Zinfandel country; smaller total acres, distinctive elevation.",
    },
    "central-valley": {
        "id": "central-valley", "name": "Central Valley (bulk)",
        "lat": 36.7378, "lon": -119.7871, "station": "Fresno",
        "note": "Warm inland valley; large share of CA winegrape acres for many varieties.",
    },
    "delta-yolo": {
        "id": "delta-yolo", "name": "Yolo / Solano",
        "lat": 38.5449, "lon": -121.7405, "station": "Davis",
        "note": "Delta-influenced plantings between Bay and Sacramento Valley.",
    },
    "southern-california": {
        "id": "southern-california", "name": "Southern California",
        "lat": 33.5030, "lon": -117.1230, "station": "Temecula",
        "note": "Smaller winegrape footprint; tourism-oriented AVAs.",
    },
    "north-interior": {
        "id": "north-interior", "name": "North Interior",
        "lat": 39.9270, "lon": -122.1800, "station": "Red Bluff / Chico",
        "note": "Interior northern counties; limited specialty acreage.",
    },
    "other-ca": {
        "id": "other-ca", "name": "Other California",
        "lat": 37.0, "lon": -120.0, "station": "Central CA (approx)",
        "note": "Counties not mapped to a named PoC region.",
    },
}

# Climate stations for major countries (representative wine points)
COUNTRY_CLIMATE = [
    {"id": "france", "name": "France (Bordeaux)", "lat": 44.8378, "lon": -0.5792, "station": "Bordeaux", "kind": "country"},
    {"id": "usa", "name": "USA (Napa)", "lat": 38.5025, "lon": -122.2654, "station": "Napa", "kind": "country"},
    {"id": "chile", "name": "Chile (Maipo)", "lat": -33.6167, "lon": -70.5667, "station": "Puente Alto / Maipo", "kind": "country"},
    {"id": "china", "name": "China (Ningxia)", "lat": 38.4872, "lon": 106.2309, "station": "Yinchuan", "kind": "country"},
    {"id": "spain", "name": "Spain (Rioja)", "lat": 42.4627, "lon": -2.4449, "station": "Logroño", "kind": "country"},
    {"id": "italy", "name": "Italy (Tuscany)", "lat": 43.7696, "lon": 11.2558, "station": "Florence", "kind": "country"},
    {"id": "australia", "name": "Australia (Barossa)", "lat": -34.5333, "lon": 138.9500, "station": "Tanunda", "kind": "country"},
    {"id": "south-africa", "name": "South Africa (Stellenbosch)", "lat": -33.9321, "lon": 18.8602, "station": "Stellenbosch", "kind": "country"},
    {"id": "argentina", "name": "Argentina (Mendoza)", "lat": -32.8895, "lon": -68.8458, "station": "Mendoza", "kind": "country"},
    {"id": "new-zealand", "name": "New Zealand (Marlborough)", "lat": -41.5130, "lon": 173.9580, "station": "Blenheim", "kind": "country"},
    {"id": "germany", "name": "Germany (Mosel)", "lat": 49.8880, "lon": 6.8760, "station": "Bernkastel-Kues", "kind": "country"},
    {"id": "portugal", "name": "Portugal (Douro)", "lat": 41.1500, "lon": -7.6000, "station": "Régua", "kind": "country"},
    {"id": "romania", "name": "Romania (Dealu Mare)", "lat": 45.0000, "lon": 26.4000, "station": "Ploiești area", "kind": "country"},
    {"id": "bulgaria", "name": "Bulgaria (Thracian)", "lat": 42.1500, "lon": 24.7500, "station": "Plovdiv", "kind": "country"},
]

COUNTRY_NAME_TO_ID = {
    "France": "france", "USA": "usa", "Chile": "chile", "China": "china",
    "Spain": "spain", "Italy": "italy", "Australia": "australia",
    "South Africa": "south-africa", "Argentina": "argentina",
    "New Zealand": "new-zealand", "Germany": "germany", "Portugal": "portugal",
    "Romania": "romania", "Bulgaria": "bulgaria",
}


def normalize(name):
    return re.sub(r"\s+", " ", re.sub(r"\s*\*+\s*$", "", name).strip())


def is_target(v):
    u = v.upper()
    for t in TARGET:
        if u == t or u.startswith(t + " "):
            return True
        if t == "PINOT GRIS" and "PINOT GRIS" in u:
            return True
        if t == "GRENACHE" and (u == "GRENACHE" or u.startswith("GRENACHE ") and "BLANC" not in u):
            return True
        if t == "MOURVEDRE" and ("MOURVEDRE" in u or "MATARO" in u):
            return True
        if t == "RIESLING" and "RIESLING" in u:
            return True
        if t == "COLOMBARD" and "COLOMBARD" in u:
            return True
    return False


def slug_variety(name):
    u = name.upper()
    if "GRENACHE BLANC" in u:
        return "grenache-blanc"
    mapping = {
        "CABERNET SAUVIGNON": "cabernet-sauvignon",
        "MERLOT": "merlot",
        "PINOT NOIR": "pinot-noir",
        "CHARDONNAY": "chardonnay",
        "SAUVIGNON BLANC": "sauvignon-blanc",
        "ZINFANDEL": "zinfandel-primitivo",
        "SYRAH": "syrah",
        "PETITE SIRAH": "petite-sirah",
        "CABERNET FRANC": "cabernet-franc",
        "PINOT GRIS": "pinot-gris",
        "CHENIN BLANC": "chenin-blanc",
        "RIESLING": "riesling",
        "WHITE RIESLING": "riesling",
        "GRENACHE": "grenache-noir",
        "TEMPRANILLO": "tempranillo",
        "SANGIOVESE": "sangiovese",
        "BARBERA": "barbera",
        "MALBEC": "malbec",
        "MOURVEDRE": "mourvedre",
        "SEMILLON": "semillon",
        "VIOGNIER": "viognier",
        "GEWURZTRAMINER": "gewurztraminer",
        "RUBY CABERNET": "ruby-cabernet",
        "PINOT BLANC": "pinot-blanc",
        "CARIGNANE": "carignane",
        "FRENCH COLOMBARD": "colombard",
        "COLOMBARD": "colombard",
    }
    for k, s in mapping.items():
        if u == k or u.startswith(k):
            return s
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def parse_table(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    current = None
    counties = defaultdict(dict)
    totals = {}
    for row in rows[4:]:
        if not row or row[0] is None:
            continue
        name = str(row[0]).strip()
        if not name:
            continue
        rest = [c for c in row[1:] if c is not None]
        if len(rest) == 0:
            current = normalize(name)
            continue
        nums = [c for c in row[1:] if isinstance(c, (int, float))]
        if not nums:
            continue
        acres_2025 = float(nums[-2] if len(nums) >= 2 else nums[-1])
        acres_2024 = float(nums[-1]) if len(nums) >= 2 else None
        if name.upper() == "STATE TOTAL" and current:
            totals[current] = {
                "acres_standing_2025": acres_2025,
                "acres_standing_2024": acres_2024,
            }
            continue
        if current:
            counties[current][name] = acres_2025
    return dict(counties), totals


w_c, w_t = parse_table(BASE / "202604gabtb06.xlsx")
r_c, r_t = parse_table(BASE / "202604gabtb07.xlsx")
all_c = {**w_c, **r_c}
all_t = {**w_t, **r_t}

varieties = []
for name in sorted(all_c.keys()):
    if not is_target(name):
        continue
    vid = slug_variety(name)
    counties = [
        {
            "county": c,
            "acres": a,
            "region_id": COUNTY_TO_REGION.get(c, "other-ca"),
        }
        for c, a in sorted(all_c[name].items(), key=lambda x: -x[1])
    ]
    # Aggregate by region
    by_region = defaultdict(float)
    for row in counties:
        by_region[row["region_id"]] += row["acres"]
    regions = [
        {"region_id": rid, "acres": round(ac, 1)}
        for rid, ac in sorted(by_region.items(), key=lambda x: -x[1])
    ]
    tot = all_t.get(name, {})
    varieties.append({
        "id": vid,
        "usda_name": name,
        "unit": "acres",
        "year": 2025,
        "crop_year_label": "2025 crop (standing acreage)",
        "state_total_acres": tot.get("acres_standing_2025"),
        "state_total_acres_prior": tot.get("acres_standing_2024"),
        "counties": counties,
        "regions": regions,
    })

payload = {
    "source": {
        "citation": "USDA NASS California Field Office. California Grape Acreage Report, 2025 Crop (Excel tables 6–7: white/red wine grapes by variety and county).",
        "url": "https://www.nass.usda.gov/Statistics_by_State/California/Publications/Specialty_and_Other_Releases/Grapes/Acreage/",
        "file": "2025GrapeAcreageExcel.zip → 202604gabtb06.xlsx (white), 202604gabtb07.xlsx (red)",
        "year": 2025,
        "unit": "acres",
        "metric": "Standing acreage total for 2025 (bearing + nonbearing as reported in Total column).",
    },
    "extracted_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    "varieties": varieties,
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(payload, indent=2) + "\n")
print("Wrote", OUT, "varieties", len(varieties))

concord = {
    "methodology": "Each California county is assigned to one primary wine region for PoC aggregation. San Luis Obispo → Paso Robles; San Joaquin+Sacramento → Lodi/Delta; Monterey+San Benito → Monterey. This is a concordance for UI rollups, not legal AVA boundaries.",
    "county_to_region": COUNTY_TO_REGION,
    "regions": list(REGIONS.values()),
    "country_climate_points": COUNTRY_CLIMATE,
    "country_name_to_climate_id": COUNTRY_NAME_TO_ID,
}
CONCORD_OUT.parent.mkdir(parents=True, exist_ok=True)
CONCORD_OUT.write_text(json.dumps(concord, indent=2) + "\n")
print("Wrote", CONCORD_OUT)

# Climate locations file for fetch script
locs = []
for r in REGIONS.values():
    locs.append({**r, "kind": "ca-region"})
locs.extend(COUNTRY_CLIMATE)
(ROOT / "src" / "data" / "climate-locations.json").write_text(json.dumps(locs, indent=2) + "\n")
print("locations", len(locs))
