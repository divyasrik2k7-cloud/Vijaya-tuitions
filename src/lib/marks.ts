import { percentage } from './attendance'
export interface MarkRow { score: number; max: number; subject: string }
export function subjectAverages(rows: MarkRow[]): { subject: string; percent: number }[] {
  const g: Record<string, { s: number; m: number }> = {}
  for (const r of rows) { const x = (g[r.subject] ??= { s: 0, m: 0 }); x.s += r.score; x.m += r.max }
  return Object.keys(g).sort().map(subject => ({ subject, percent: percentage(g[subject].s, g[subject].m) }))
}
