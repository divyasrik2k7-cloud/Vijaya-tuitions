import { useEffect, useState, FormEvent } from 'react'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
type Opt = { id: string; name: string }
const schema = z.object({ title: z.string().trim().min(1, 'Title required'), subject_id: z.string().min(1, 'Choose a subject'), class_id: z.string().min(1, 'Choose a class'), duration_minutes: z.coerce.number().int().min(1).max(300), available_from: z.string().min(1, 'Start required'), available_until: z.string().min(1, 'End required') })
export default function Tests() {
  const [subjects, setSubjects] = useState<Opt[]>([]); const [classes, setClasses] = useState<Opt[]>([]); const [list, setList] = useState<any[]>([]); const [sel, setSel] = useState<any>(null); const [qs, setQs] = useState<any[]>([]); const [keys, setKeys] = useState<Record<string, string>>({}); const [atts, setAtts] = useState<any[]>([]); const [msg, setMsg] = useState('')
  const loadList = async () => { const { data } = await supabase.from('online_tests').select('id,title,duration_minutes,available_from,available_until,published,results_released,subjects(name),classes(name)').order('created_at', { ascending: false }); setList(data ?? []) }
  useEffect(() => { loadList(); supabase.from('subjects').select('id,name').order('name').then(r => setSubjects(r.data ?? [])); supabase.from('classes').select('id,name').order('name').then(r => setClasses(r.data ?? [])) }, [])
  async function open(t: any) { setSel(t); setMsg('')
    const [q, a] = await Promise.all([supabase.from('test_questions').select('id,body,marks,position,test_options(id,body,position)').eq('test_id', t.id).order('position'), supabase.from('test_attempts').select('id,submitted_at,student_profiles(full_name),test_results(score,max_score)').eq('test_id', t.id)])
    setQs(q.data ?? []); setAtts(a.data ?? []); const ids = (q.data ?? []).map((x: any) => x.id)
    const k = ids.length ? await supabase.from('test_answer_keys').select('question_id,option_id').in('question_id', ids) : { data: [] as any[] }; setKeys(Object.fromEntries((k.data ?? []).map((x: any) => [x.question_id, x.option_id]))) }
  async function create(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const p = schema.safeParse(Object.fromEntries(new FormData(form))); if (!p.success) return setMsg(p.error.issues[0].message)
    const from = new Date(p.data.available_from), to = new Date(p.data.available_until); if (to <= from) return setMsg('End must be after start'); const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('online_tests').insert({ ...p.data, available_from: from.toISOString(), available_until: to.toISOString(), teacher_id: user!.id }); setMsg(error ? 'Could not create test' : 'Test created (unpublished)'); if (!error) { form.reset(); loadList() } }
  async function addQ(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form); const body = String(fd.get('body') ?? '').trim(); const marks = Number(fd.get('marks') || 1)
    const opts = [0, 1, 2, 3].map(i => String(fd.get('o' + i) ?? '').trim()); const correct = Number(fd.get('correct'))
    if (!body) return setMsg('Question text required'); if (opts.filter(Boolean).length < 2) return setMsg('Give at least two options'); if (!(marks > 0)) return setMsg('Marks must be positive'); if (!opts[correct]) return setMsg('Select a correct option that is filled in')
    const q = await supabase.from('test_questions').insert({ test_id: sel.id, position: qs.length + 1, body, marks }).select('id').single(); if (q.error) return setMsg('Could not add question')
    const o = await supabase.from('test_options').insert(opts.map((b, i) => ({ b, i })).filter(x => x.b).map(x => ({ question_id: q.data.id, position: x.i, body: x.b }))).select('id,position')
    const cid = o.data?.find(x => x.position === correct)?.id; const k = cid ? await supabase.from('test_answer_keys').insert({ question_id: q.data.id, option_id: cid }) : { error: true }
    if (o.error || k.error) { await supabase.from('test_questions').delete().eq('id', q.data.id); return setMsg('Could not save options') } form.reset(); setMsg('Question added'); open(sel) }
  async function flag(field: 'published' | 'results_released') { if (field === 'published' && !sel.published && qs.length === 0) return setMsg('Add at least one question before publishing')
    const { error } = await supabase.from('online_tests').update({ [field]: !sel[field] }).eq('id', sel.id); if (error) return setMsg('Could not update'); setSel({ ...sel, [field]: !sel[field] }); loadList() }
  const inp = 'border rounded p-2'
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Online tests</h1>
    <form onSubmit={create} className="bg-white rounded-2xl p-4 grid md:grid-cols-3 gap-2"><input name="title" placeholder="Test title" className={inp} aria-label="Title" />
      <select name="subject_id" className={inp} aria-label="Subject"><option value="">Subject</option>{subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select name="class_id" className={inp} aria-label="Class"><option value="">Class</option>{classes.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <input name="duration_minutes" type="number" placeholder="Minutes" className={inp} aria-label="Duration in minutes" /><input name="available_from" type="datetime-local" className={inp} aria-label="Available from" /><input name="available_until" type="datetime-local" className={inp} aria-label="Available until" />
      <button className="bg-navy text-white rounded p-2 md:col-span-3">Create test</button></form>{msg && <p role="status">{msg}</p>}
    {list.length === 0 ? <p>No tests yet.</p> : <ul className="bg-white rounded-2xl p-4">{list.map(t => <li key={t.id} className="flex justify-between border-b py-1"><span>{t.title} · {t.subjects?.name} · {t.classes?.name} · {t.duration_minutes} min · {t.published ? 'Published' : 'Draft'}</span><button className="underline" onClick={() => open(t)}>Manage</button></li>)}</ul>}
    {sel && <div className="bg-white rounded-2xl p-4 space-y-3"><h2 className="font-semibold">{sel.title}</h2><div className="flex gap-3"><button className="underline" onClick={() => flag('published')}>{sel.published ? 'Unpublish' : 'Publish'}</button><button className="underline" onClick={() => flag('results_released')}>{sel.results_released ? 'Hide results from students' : 'Release results to students'}</button></div>
      <ol className="list-decimal pl-5">{qs.map(q => <li key={q.id}>{q.body} ({q.marks})<ul>{[...q.test_options].sort((a: any, b: any) => a.position - b.position).map((o: any) => <li key={o.id}>{o.id === keys[q.id] ? '✓ ' : '• '}{o.body}</li>)}</ul></li>)}</ol>
      <form onSubmit={addQ} className="grid gap-2"><input name="body" placeholder="Question" className={inp} aria-label="Question" /><input name="marks" type="number" step="0.5" defaultValue={1} className={inp} aria-label="Marks" />
        {[0, 1, 2, 3].map(i => <div key={i} className="flex gap-2"><input type="radio" name="correct" value={i} defaultChecked={i === 0} aria-label={`Option ${i + 1} is correct`} /><input name={'o' + i} placeholder={`Option ${i + 1}`} className={inp + ' flex-1'} aria-label={`Option ${i + 1}`} /></div>)}<button className="bg-navy text-white rounded p-2">Add question</button></form>
      <h3 className="font-semibold">Attempts</h3>{atts.length === 0 ? <p>No attempts yet.</p> : <ul>{atts.map(a => { const r = Array.isArray(a.test_results) ? a.test_results[0] : a.test_results; return <li key={a.id}>{a.student_profiles?.full_name}: {a.submitted_at ? (r ? `${r.score}/${r.max_score}` : 'submitted') : 'in progress'}</li> })}</ul>}</div>}</div>
}
