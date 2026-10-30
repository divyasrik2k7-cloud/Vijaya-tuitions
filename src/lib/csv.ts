export function parseCsv(text: string): string[][] {
  const out: string[][] = []; let row: string[] = [], f = '', q = false
  for (let i = 0; i < text.length; i++) { const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); out.push(row); row = []; f = '' }
    else f += c }
  if (f !== '' || row.length) { row.push(f); out.push(row) }
  return out.filter(r => r.some(x => x.trim() !== ''))
}
export interface ImportRow { line: number; student_code: string; full_name: string; email: string; guardian_name: string; guardian_phone: string; errors: string[] }
export function validateImport(rows: string[][], existingCodes: Set<string>, existingEmails: Set<string>): { rows: ImportRow[]; missing: string[] } {
  const head = (rows[0] ?? []).map(h => h.trim().toLowerCase()); const need = ['student_code', 'full_name', 'email']; const missing = need.filter(n => !head.includes(n))
  if (missing.length) return { rows: [], missing }
  const col = (r: string[], n: string) => (r[head.indexOf(n)] ?? '').trim(); const seenC = new Set<string>(), seenE = new Set<string>()
  const out = rows.slice(1).map((r, i) => { const x: ImportRow = { line: i + 2, student_code: col(r, 'student_code'), full_name: col(r, 'full_name'), email: col(r, 'email').toLowerCase(), guardian_name: col(r, 'guardian_name'), guardian_phone: col(r, 'guardian_phone'), errors: [] }
    if (!x.student_code) x.errors.push('Missing student ID'); if (x.full_name.length < 2) x.errors.push('Name too short')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email)) x.errors.push('Invalid email')
    if (existingCodes.has(x.student_code) || seenC.has(x.student_code)) x.errors.push('Duplicate student ID'); if (existingEmails.has(x.email) || seenE.has(x.email)) x.errors.push('Duplicate email')
    seenC.add(x.student_code); seenE.add(x.email); return x })
  return { rows: out, missing: [] }
}
