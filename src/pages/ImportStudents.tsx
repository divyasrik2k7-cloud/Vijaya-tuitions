import { useState, ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { parseCsv, validateImport, ImportRow } from '../lib/csv'
export default function ImportStudents() {
  const [rows, setRows] = useState<ImportRow[]>([]); const [missing, setMissing] = useState<string[]>([]); const [report, setReport] = useState<string[][]>([]); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  async function pick(e: ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; setReport([]); setMsg('')
    const { data } = await supabase.from('student_profiles').select('student_code,email'); const v = validateImport(parseCsv(await f.text()), new Set((data ?? []).map(x => x.student_code)), new Set((data ?? []).map(x => x.email.toLowerCase()))); setRows(v.rows); setMissing(v.missing) }
  const ok = rows.filter(r => r.errors.length === 0)
  async function run() { if (!ok.length || busy || !confirm(`Create ${ok.length} students and send invitation emails? Existing records are never overwritten.`)) return
    setBusy(true); const { data: { session } } = await supabase.auth.getSession(); const rep: string[][] = [['line', 'student_code', 'email', 'result']]
    for (const r of rows) { if (r.errors.length) { rep.push([String(r.line), r.student_code, r.email, 'skipped: ' + r.errors.join('; ')]); continue }
      const res = await fetch('/.netlify/functions/provision-student', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ student_code: r.student_code, full_name: r.full_name, email: r.email, guardian_name: r.guardian_name || undefined, guardian_phone: r.guardian_phone || undefined }) })
      const j = await res.json().catch(() => ({})); rep.push([String(r.line), r.student_code, r.email, res.ok ? 'imported' : 'failed: ' + (j.error ?? res.status)]) }
    setReport(rep); setBusy(false); setMsg(`Done: ${rep.filter(x => x[3] === 'imported').length} imported, ${rep.length - 1 - rep.filter(x => x[3] === 'imported').length} not imported.`) }
  function dl() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([report.map(r => r.map(c => '"' + c.replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' })); a.download = 'import-reconciliation.csv'; a.click() }
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Import students (CSV)</h1><p>Required columns: student_code, full_name, email. Optional: guardian_name, guardian_phone.</p>
    <input type="file" accept=".csv,text/csv" onChange={pick} aria-label="CSV file" />{missing.length > 0 && <p role="alert">Missing columns: {missing.join(', ')}</p>}
    {rows.length > 0 && <><p>{ok.length} valid, {rows.length - ok.length} with errors (preview, nothing written yet).</p><table className="w-full bg-white rounded-2xl text-sm"><tbody>{rows.map(r => <tr key={r.line} className="border-b"><td className="p-1">{r.line}</td><td>{r.student_code}</td><td>{r.full_name}</td><td>{r.email}</td><td className="text-red-700">{r.errors.join('; ')}</td></tr>)}</tbody></table>
      <button disabled={busy || !ok.length} onClick={run} className="bg-navy text-white rounded p-2 px-4">{busy ? 'Importing…' : `Confirm import of ${ok.length} rows`}</button></>}
    {msg && <p role="status">{msg}</p>}{report.length > 0 && <button className="underline" onClick={dl}>Download reconciliation report</button>}</div>
}
