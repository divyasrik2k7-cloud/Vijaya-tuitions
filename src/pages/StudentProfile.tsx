import { useEffect, useState, FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { attendancePercent, Status } from '../lib/attendance'
const schema = z.object({ full_name: z.string().trim().min(2, 'Name is too short'), guardian_phone: z.string().trim().regex(/^[0-9+\-\s]{0,15}$/, 'Invalid phone number') })
type Opt = { id: string; name: string }
export default function StudentProfile() {
  const { id } = useParams(); const [s, setS] = useState<any>(null); const [classes, setClasses] = useState<Opt[]>([]); const [subjects, setSubjects] = useState<Opt[]>([])
  const [mine, setMine] = useState<string[]>([]); const [att, setAtt] = useState<{ status: Status }[]>([]); const [msg, setMsg] = useState(''); const [missing, setMissing] = useState(false)
  useEffect(() => { (async () => {
    const [p, c, sub, ss, a] = await Promise.all([
      supabase.from('student_profiles').select('*').eq('id', id).maybeSingle(), supabase.from('classes').select('id,name').order('name'), supabase.from('subjects').select('id,name').order('name'),
      supabase.from('student_subjects').select('subject_id').eq('student_id', id), supabase.from('attendance').select('status').eq('student_id', id)])
    if (!p.data) return setMissing(true)
    setS(p.data); setClasses(c.data ?? []); setSubjects(sub.data ?? []); setMine((ss.data ?? []).map((x: any) => x.subject_id)); setAtt((a.data ?? []) as any) })() }, [id])
  async function save(e: FormEvent<HTMLFormElement>) { e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const v = schema.safeParse({ full_name: f.full_name, guardian_phone: f.guardian_phone ?? '' }); if (!v.success) return setMsg(v.error.issues[0].message)
    const { error } = await supabase.from('student_profiles').update({ full_name: v.data.full_name, guardian_phone: v.data.guardian_phone || null, class_id: f.class_id || null, school_name: f.school_name || null,
      guardian_name: f.guardian_name || null, notes: f.notes || null, enrolled_on: f.enrolled_on || null }).eq('id', id)
    setMsg(error ? 'Could not save changes' : 'Saved') }
  async function toggle(sid: string) { const on = mine.includes(sid)
    const { error } = on ? await supabase.from('student_subjects').delete().eq('student_id', id).eq('subject_id', sid) : await supabase.from('student_subjects').insert({ student_id: id, subject_id: sid })
    if (error) return setMsg('Could not update subjects'); setMine(on ? mine.filter(x => x !== sid) : [...mine, sid]) }
  if (missing) return <p>Student not found. <Link className="underline" to="/teacher/students">Back</Link></p>
  if (!s) return <p>Loading…</p>
  const inp = 'border rounded p-2 w-full'
  return <div className="space-y-4"><Link className="underline" to="/teacher/students">← Students</Link> · <Link className="underline" to={`/teacher/students/${id}/report`}>Progress report</Link><h1 className="text-2xl font-bold">{s.full_name} <span className="text-sm text-slate-500">{s.student_code} · {s.email}</span></h1>
    <form onSubmit={save} className="bg-white rounded-2xl p-4 grid md:grid-cols-2 gap-2">
      <input name="full_name" defaultValue={s.full_name} className={inp} aria-label="Full name" />
      <select name="class_id" defaultValue={s.class_id ?? ''} className={inp} aria-label="Class"><option value="">No class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input name="school_name" defaultValue={s.school_name ?? ''} placeholder="School / college" className={inp} aria-label="School" />
      <input name="enrolled_on" type="date" defaultValue={s.enrolled_on ?? ''} className={inp} aria-label="Enrollment date" />
      <input name="guardian_name" defaultValue={s.guardian_name ?? ''} placeholder="Guardian name" className={inp} aria-label="Guardian name" />
      <input name="guardian_phone" defaultValue={s.guardian_phone ?? ''} placeholder="Guardian phone" className={inp} aria-label="Guardian phone" />
      <textarea name="notes" defaultValue={s.notes ?? ''} placeholder="Teacher notes" className={inp + ' md:col-span-2'} aria-label="Notes" />
      <button className="bg-navy text-white rounded p-2 md:col-span-2">Save changes</button>{msg && <p role="status" className="md:col-span-2">{msg}</p>}</form>
    <div className="bg-white rounded-2xl p-4"><h2 className="font-semibold">Subjects</h2>{subjects.length === 0 ? <p>Create subjects first under Classes &amp; subjects.</p> :
      subjects.map(x => <label key={x.id} className="mr-4"><input type="checkbox" checked={mine.includes(x.id)} onChange={() => toggle(x.id)} /> {x.name}</label>)}</div>
    <p className="bg-white rounded-2xl p-4">Attendance: {att.length ? attendancePercent(att) + '% over ' + att.length + ' recorded days' : 'none recorded'}</p></div>
}
