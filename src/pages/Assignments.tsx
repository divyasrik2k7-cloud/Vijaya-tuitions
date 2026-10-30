import { useEffect, useState, FormEvent } from 'react'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { openFile } from '../lib/storage'
type Opt = { id: string; name: string }
const schema = z.object({ title: z.string().trim().min(1, 'Title required'), subject_id: z.string().min(1, 'Choose a subject'), class_id: z.string().min(1, 'Choose a class'), due_at: z.string().min(1, 'Deadline required') })
export default function Assignments() {
  const [subjects, setSubjects] = useState<Opt[]>([]); const [classes, setClasses] = useState<Opt[]>([]); const [mats, setMats] = useState<{ id: string; title: string }[]>([]); const [list, setList] = useState<any[]>([])
  const [sel, setSel] = useState<any>(null); const [students, setStudents] = useState<any[]>([]); const [subs, setSubs] = useState<Record<string, any>>({}); const [edit, setEdit] = useState<Record<string, { marks: string; feedback: string }>>({}); const [msg, setMsg] = useState('')
  const loadList = async () => { const { data } = await supabase.from('assignments').select('id,title,due_at,max_marks,class_id,subjects(name),classes(name)').order('due_at', { ascending: false }); setList(data ?? []) }
  useEffect(() => { loadList(); supabase.from('subjects').select('id,name').order('name').then(r => setSubjects(r.data ?? [])); supabase.from('classes').select('id,name').order('name').then(r => setClasses(r.data ?? [])); supabase.from('learning_materials').select('id,title').order('title').then(r => setMats(r.data ?? [])) }, [])
  async function create(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const f = Object.fromEntries(new FormData(form)) as Record<string, string>
    const p = schema.safeParse(f); if (!p.success) return setMsg(p.error.issues[0].message)
    const mm = f.max_marks ? Number(f.max_marks) : null; if (mm !== null && !(mm > 0)) return setMsg('Max marks must be positive')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('assignments').insert({ title: p.data.title, subject_id: p.data.subject_id, class_id: p.data.class_id, due_at: new Date(p.data.due_at).toISOString(), instructions: f.instructions || null, max_marks: mm, material_id: f.material_id || null, teacher_id: user!.id })
    setMsg(error ? 'Could not create assignment' : 'Assignment created'); if (!error) { form.reset(); loadList() } }
  async function open(a: any) { setSel(a); setMsg('')
    const [s, m] = await Promise.all([supabase.from('student_profiles').select('id,full_name').eq('class_id', a.class_id).eq('is_active', true).order('full_name'), supabase.from('assignment_submissions').select('id,student_id,status,marks,feedback,file_name,storage_path').eq('assignment_id', a.id)])
    setStudents(s.data ?? []); setSubs(Object.fromEntries((m.data ?? []).map(x => [x.student_id, x]))); setEdit(Object.fromEntries((m.data ?? []).map(x => [x.student_id, { marks: x.marks == null ? '' : String(x.marks), feedback: x.feedback ?? '' }]))) }
  async function review(sid: string) { const sub = subs[sid]; const v = edit[sid] ?? { marks: '', feedback: '' }; const marks = v.marks === '' ? null : Number(v.marks)
    if (marks !== null && (!(marks >= 0) || (sel.max_marks != null && marks > sel.max_marks))) return setMsg('Marks out of range')
    const { error } = await supabase.from('assignment_submissions').update({ marks, feedback: v.feedback || null, status: 'reviewed' }).eq('id', sub.id); setMsg(error ? 'Could not save review' : 'Review saved'); open(sel) }
  const inp = 'border rounded p-2'; const submitted = Object.keys(subs).length
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Homework &amp; assignments</h1>
    <form onSubmit={create} className="bg-white rounded-2xl p-4 grid md:grid-cols-3 gap-2"><input name="title" placeholder="Title" className={inp} aria-label="Title" />
      <select name="subject_id" className={inp} aria-label="Subject"><option value="">Subject</option>{subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select name="class_id" className={inp} aria-label="Class"><option value="">Class</option>{classes.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <input name="due_at" type="datetime-local" className={inp} aria-label="Deadline" /><input name="max_marks" type="number" step="0.5" placeholder="Max marks (optional)" className={inp} aria-label="Max marks" />
      <select name="material_id" className={inp} aria-label="Reference material"><option value="">No reference material</option>{mats.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
      <textarea name="instructions" placeholder="Instructions" className={inp + ' md:col-span-3'} aria-label="Instructions" /><button className="bg-navy text-white rounded p-2 md:col-span-3">Create assignment</button></form>
    {msg && <p role="status">{msg}</p>}
    {list.length === 0 ? <p>No assignments yet.</p> : <ul className="bg-white rounded-2xl p-4">{list.map(a => <li key={a.id} className="flex justify-between border-b py-1"><span>{a.title} · {a.subjects?.name} · {a.classes?.name} · due {new Date(a.due_at).toLocaleString()}</span><button className="underline" onClick={() => open(a)}>Submissions</button></li>)}</ul>}
    {sel && <div className="bg-white rounded-2xl p-4 space-y-2"><h2 className="font-semibold">{sel.title}: {submitted} of {students.length} submitted ({students.length - submitted} pending)</h2>
      {students.map(s => { const sub = subs[s.id]; return <div key={s.id} className="flex flex-wrap gap-2 items-center"><span className="w-44">{s.full_name}</span>
        {!sub ? <span className="text-slate-500">Not submitted</span> : <><button className="underline" onClick={async () => { if (!(await openFile('submissions', sub.storage_path))) setMsg('Could not open file') }}>{sub.file_name}</button><span>{sub.status}</span>
          <input type="number" step="0.5" value={edit[s.id]?.marks ?? ''} onChange={e => setEdit({ ...edit, [s.id]: { marks: e.target.value, feedback: edit[s.id]?.feedback ?? '' } })} className="border rounded p-1 w-20" aria-label={`Marks for ${s.full_name}`} />
          <input value={edit[s.id]?.feedback ?? ''} onChange={e => setEdit({ ...edit, [s.id]: { marks: edit[s.id]?.marks ?? '', feedback: e.target.value } })} placeholder="Feedback" className="border rounded p-1 flex-1" aria-label={`Feedback for ${s.full_name}`} />
          <button className="underline" onClick={() => review(s.id)}>Mark reviewed</button></>}</div> })}</div>}</div>
}
