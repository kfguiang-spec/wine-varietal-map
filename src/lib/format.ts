export function formatHa(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return Math.round(n).toLocaleString('en-US')
}

export function formatAcres(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return Math.round(n).toLocaleString('en-US')
}

export function pct(part: number, whole: number): string {
  if (!whole) return '—'
  return `${((100 * part) / whole).toFixed(1)}%`
}

/** Rough acres → ha for UI cross-check only (1 ha ≈ 2.471 acres). */
export function acresToHa(acres: number): number {
  return acres / 2.471
}
