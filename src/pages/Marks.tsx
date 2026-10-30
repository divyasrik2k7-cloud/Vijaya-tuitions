import { useEffect, useState, FormEvent } from 'react'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validateMarks, percentage } from '../lib/attendance'
type Opt = { id: string; name: string }
const schema = z.object({ title: z.string().trim().min(1, 'Title required'), subject_id: z.string().min(1, 'Choose a subject'), class_id: z.string().min(1, 'Choose a class'), max_marks: z.coerce.number().positive('Max marks must be positive'), held_on: z.string().min(1, 'Date required') })
export default function Marks() {
  const [classes, setClasses] = useState<Opt[]>([]); const [subjects, setSubjects] = useState<Opt[]>([]); const [list, setList] = useState<any[]>([]); const [sel, setSel] = useState<any>(null)
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([]); const [v, setV] = useState<Record<string, { score: string; remarks: string }>>({}); const [msg, setMsg] = useState('')
  const loadList = async () => { const { data } = await supabase.from('assessments').select('id,title,max_marks,held_on,released,class_id,subjects(name),classes(name)').order('held_on', { ascending: false }); setList(data ?? []) }
  useEffect(() => { loadList(); supabase.from('classes').select('id,name').order('name').then(r => setClasses(r.data ?? [])); supabase.from('subjects').select('id,name').order('name').then(r => setSubjects(r.data ?? [])) }, [])
  async function create(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = e.currentTarget
    const p = schema.safeParse(Object.fromEntries(new FormData(f))); if (!p.success) return setMsg(p.error.issues[0].message)
    const { data: { user } } = await supabase.auth.getUser(); const { error } = await supabase.from('assessments').insert({ ...p.data, teacher_id: user!.id })
    setMsg(error ? 'Could not create assessment' : 'Assessment created'); if (!error) { f.reset(); loadList() } }
  async function open(a: any) { setSel(a); setMsg('')
    const [s, m] = await Promise.all([supabase.from('student_profiles').select('id,full_name').eq('class_id', a.class_id).eq('is_active', true).order('full_name'), supabase.from('assessment_marks').select('student_id,score,remarks').eq('assessment_id', a.id)])
    setStudents(s.data ?? []); setV(Object.fromEntries((m.data ?? []).map(r => [r.student_id, { score: String(r.score), remarks: r.remarks ?? '' }]))) }
  async function save() { const rows = []
    for (const s of students) { const x = v[s.id]; if (!x || x.score === '') continue; const err = validateMarks(Number(x.score), sel.max_marks); if (err) return setMsg(`${s.full_name}: ${err}`)
      rows.push({ assessment_id: sel.id, student_id: s.id, score: Number(x.score), remarks: x.remarks || null }) }
    if (!rows.length) return setMsg('Enter at least one mark')
    const { error } = await supabase.from('assessment_marks').upsert(rows, { onConflict: 'assessment_id,student_id' }); setMsg(error ? 'Could not save marks' : `Saved ${rows.length} marks`) }
  async function release() { const { error } = await supabase.from('assessments').update({ released: !sel.released }).eq('id', sel.id)
    if (error) return setMsg('Could not update release status'); setSel({ ...sel, released: !sel.released }); loadList() }
  const inp = 'border rounded p-2'
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Marks</h1>
    <form onSubmit={create} className="bg-white rounded-2xl p-4 grid md:grid-cols-3 gap-2"><input name="title" placeholder="Assessment title" className={inp} aria-label="Title" />
      <select name="subject_id" className={inp} aria-label="Subject"><option value="">Subject</option>{subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select name="class_id" className={inp} aria-label="Class"><option value="">Class</option>{classes.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <input name="max_marks" type="number" step="0.5" placeholder="Max marks" className={inp} aria-label="Max marks" /><input name="held_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inp} aria-label="Date" /><button className="bg-navy text-white rounded p-2">Create</button></form>
    {msg && <p role="status">{msg}</p>}
    {list.length === 0 ? <p>No assessments yet. Create classes and subjects first, then an assessment above.</p> : <ul className="bg-white rounded-2xl p-4">{list.map(a => <li key={a.id} className="flex justify-between border-b py-1"><span>{a.title} · {a.subjects?.name} · {a.classes?.name} · /{a.max_marks} · {a.held_on} {a.released ? '(released)' : '(hidden)'}</span><button className="underline" onClick={() => open(a)}>Enter marks</button></li>)}</ul>}
    {sel && <div className="bg-white rounded-2xl p-4 space-y-2"><h2 className="font-semibold">{sel.title} (max {sel.max_marks})</h2>
      {students.length === 0 ? <p>No active students in this class.</p> : students.map(s => <div key={s.id} className="flex gap-2 items-center"><span className="w-48">{s.full_name}</span>
        <input type="number" step="0.5" value={v[s.id]?.score ?? ''} onChange={e => setV({ ...v, [s.id]: { score: e.target.value, remarks: v[s.id]?.remarks ?? '' } })} className="border rounded p-1 w-24" aria-label={`Score for ${s.full_name}`} />
        <span className="w-16">{v[s.id]?.score ? percentage(Number(v[s.id].score), sel.max_marks) + '%' : ''}</span>
        <input value={v[s.id]?.remarks ?? ''} onChange={e => setV({ ...v, [s.id]: { score: v[s.id]?.score ?? '', remarks: e.target.value } })} placeholder="Remarks" className="border rounded p-1 flex-1" aria-label={`Remarks for ${s.full_name}`} /></div>)}
      <button onClick={save} className="bg-navy text-white rounded p-2 px-4">Save marks</button><button onClick={release} className="ml-2 underline">{sel.released ? 'Unrelease (hide from students)' : 'Release to students'}</button></div>}</div>
}
