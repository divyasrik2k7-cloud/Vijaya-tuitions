export type Status = 'present' | 'absent' | 'late'
export function attendancePercent(records: { status: Status }[]): number {
  if (!records.length) return 0
  const attended = records.filter(r => r.status !== 'absent').length
  return Math.round((attended / records.length) * 1000) / 10
}
export function validateMarks(score: number, max: number): string | null {
  if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return 'Invalid marks'
  if (score < 0) return 'Marks cannot be negative'
  if (score > max) return 'Marks cannot exceed maximum'
  return null
}
export const percentage = (score: number, max: number) => Math.round((score / max) * 1000) / 10

export function monthlyPercent(rows: { attended_on: string; status: Status }[]): { month: string; percent: number }[] {
  const g: Record<string, { status: Status }[]> = {}
  for (const r of rows) (g[r.attended_on.slice(0, 7)] ??= []).push(r)
  return Object.keys(g).sort().map(month => ({ month, percent: attendancePercent(g[month]) }))
}
