import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { attendancePercent, Status } from '../lib/attendance'
export default function AttendanceReport() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); const [rows, setRows] = useState<{ name: string; code: string; days: number; pct: number }[]>([]); const [err, setErr] = useState('')
  useEffect(() => { (async () => {
    const [y, m] = month.split('-').map(Number); const from = `${month}-01`; const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
    const [s, a] = await Promise.all([supabase.from('student_profiles').select('id,full_name,student_code').order('full_name'), supabase.from('attendance').select('student_id,status').gte('attended_on', from).lt('attended_on', to)])
    if (s.error || a.error) return setErr('Could not load report'); setErr('')
    const by: Record<string, { status: Status }[]> = {}; for (const r of a.data ?? []) (by[r.student_id] ??= []).push({ status: r.status })
    setRows((s.data ?? []).filter(x => by[x.id]).map(x => ({ name: x.full_name, code: x.student_code, days: by[x.id].length, pct: attendancePercent(by[x.id]) }))) })() }, [month])
  function csv() { const l = ['student_id,name,records,attendance_percent', ...rows.map(r => `"${r.code}","${r.name.replace(/"/g, '""')}",${r.days},${r.pct}`)]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([l.join('\n')], { type: 'text/csv' })); a.download = `attendance-report-${month}.csv`; a.click() }
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Monthly attendance report</h1><input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border rounded p-2" aria-label="Month" />
    {err && <p role="alert">{err}</p>}{rows.length === 0 ? <p>No attendance recorded for this month.</p> : <><table className="w-full bg-white rounded-2xl"><thead><tr className="text-left"><th className="p-2">ID</th><th>Name</th><th>Records</th><th>Attendance</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.code} className="border-t"><td className="p-2">{r.code}</td><td>{r.name}</td><td>{r.days}</td><td>{r.pct}%</td></tr>)}</tbody></table><button className="underline" onClick={csv}>Export CSV</button></>}</div>
}
