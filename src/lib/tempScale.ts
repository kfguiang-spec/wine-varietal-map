export type TempUnit = 'C' | 'F'

/** Source climate.json stores °C; display conversion only. */
export function cToF(c: number): number {
  return (c * 9) / 5 + 32
}

export function toDisplay(c: number | null | undefined, unit: TempUnit): number | null {
  if (c == null || Number.isNaN(c)) return null
  return unit === 'F' ? cToF(c) : c
}

export function formatTemp(c: number | null | undefined, unit: TempUnit): string {
  const v = toDisplay(c, unit)
  if (v == null) return '—'
  return `${v.toFixed(1)} °${unit}`
}

export function unitLabel(unit: TempUnit): string {
  return unit === 'F' ? '°F' : '°C'
}
