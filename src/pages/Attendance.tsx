import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Status, attendancePercent } from '../lib/attendance'
interface S { id: string; full_name: string; student_code: string; class_id: string | null }
const SESSIONS = ['main', 'morning', 'afternoon', 'evening']
export default function Attendance() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [session, setSession] = useState('main'); const [cls, setCls] = useState('')
  const [students, setStudents] = useState<S[]>([]); const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [st, setSt] = useState<Record<string, Status>>({}); const [notes, setNotes] = useState<Record<string, string>>({}); const [msg, setMsg] = useState('')
  useEffect(() => { (async () => {
    const { data: s } = await supabase.from('student_profiles').select('id,full_name,student_code,class_id').eq('is_active', true).order('full_name'); setStudents(s ?? [])
    const { data: c } = await supabase.from('classes').select('id,name').order('name'); setClasses(c ?? []) })() }, [])
  useEffect(() => { (async () => {
    const { data: a } = await supabase.from('attendance').select('student_id,status,note').eq('attended_on', date).eq('session', session)
    setSt(Object.fromEntries((a ?? []).map(r => [r.student_id, r.status as Status]))); setNotes(Object.fromEntries((a ?? []).map(r => [r.student_id, r.note ?? '']))); setMsg('') })() }, [date, session])
  const visible = students.filter(s => !cls || s.class_id === cls)
  async function save() { const { data: { user } } = await supabase.auth.getUser()
    const rows = visible.filter(s => st[s.id]).map(s => ({ student_id: s.id, status: st[s.id], note: notes[s.id] || null, attended_on: date, session, teacher_id: user!.id }))
    if (!rows.length) return setMsg('Mark at least one student first')
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,attended_on,session' }); setMsg(error ? 'Could not save attendance' : `Saved ${rows.length} records`) }
  function csv() { const lines = ['student_id,name,date,session,status,note', ...visible.map(s => [s.student_code, s.full_name, date, session, st[s.id] ?? '', notes[s.id] ?? ''].map(v => '"' + v.replace(/"/g, '""') + '"').join(','))]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = `attendance-${date}-${session}.csv`; a.click() }
  const marked = visible.filter(s => st[s.id]).map(s => ({ status: st[s.id] }))
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Attendance</h1>
    <div className="flex flex-wrap gap-2 items-center"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded p-2" aria-label="Date" />
      <select value={session} onChange={e => setSession(e.target.value)} className="border rounded p-2" aria-label="Session">{SESSIONS.map(x => <option key={x}>{x}</option>)}</select>
      <select value={cls} onChange={e => setCls(e.target.value)} className="border rounded p-2" aria-label="Class"><option value="">All classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <button className="underline" onClick={() => setSt({ ...st, ...Object.fromEntries(visible.map(s => [s.id, 'present' as Status])) })}>Mark all present</button></div>
    {visible.length === 0 ? <p>No active students in this selection.</p> : <table className="w-full bg-white rounded-2xl"><tbody>{visible.map(s => <tr key={s.id} className="border-b"><td className="p-2">{s.full_name}</td>
      <td>{(['present', 'late', 'absent'] as Status[]).map(x => <label key={x} className="mr-3"><input type="radio" name={s.id} checked={st[s.id] === x} onChange={() => setSt({ ...st, [s.id]: x })} /> {x}</label>)}</td>
      <td><input value={notes[s.id] ?? ''} onChange={e => setNotes({ ...notes, [s.id]: e.target.value })} placeholder="Note" aria-label={`Note for ${s.full_name}`} className="border rounded p-1" /></td></tr>)}</tbody></table>}
    <p>This session: {marked.length ? attendancePercent(marked) + '% attended' : 'nothing marked'}</p>
    <button onClick={save} className="bg-navy text-white rounded p-2 px-4">Save</button><button onClick={csv} className="ml-2 underline">Export CSV</button>{msg && <p role="status">{msg}</p>}</div>
}
