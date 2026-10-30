import { useEffect, useState, FormEvent } from 'react'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
type Opt = { id: string; name: string }
const schema = z.object({ title: z.string().trim().min(1, 'Title required'), body: z.string().trim().min(1, 'Message required'), kind: z.enum(['general', 'exam reminder', 'assignment reminder']) })
export default function Announcements() {
  const [classes, setClasses] = useState<Opt[]>([]); const [subjects, setSubjects] = useState<Opt[]>([]); const [list, setList] = useState<any[]>([]); const [msg, setMsg] = useState('')
  const load = async () => { const { data } = await supabase.from('announcements').select('id,title,body,kind,status,created_at,classes(name),subjects(name)').order('created_at', { ascending: false }); setList(data ?? []) }
  useEffect(() => { load(); supabase.from('classes').select('id,name').order('name').then(r => setClasses(r.data ?? [])); supabase.from('subjects').select('id,name').order('name').then(r => setSubjects(r.data ?? [])) }, [])
  async function create(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const f = Object.fromEntries(new FormData(form)) as Record<string, string>
    const p = schema.safeParse(f); if (!p.success) return setMsg(p.error.issues[0].message); const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('announcements').insert({ ...p.data, class_id: f.class_id || null, subject_id: f.subject_id || null, teacher_id: user!.id }); setMsg(error ? 'Could not publish' : 'Published'); if (!error) { form.reset(); load() } }
  async function edit(a: any) { const title = prompt('Title', a.title)?.trim(); if (!title) return; const body = prompt('Message', a.body)?.trim(); if (!body) return
    const { error } = await supabase.from('announcements').update({ title, body }).eq('id', a.id); setMsg(error ? 'Could not update' : ''); load() }
  async function toggle(a: any) { const { error } = await supabase.from('announcements').update({ status: a.status === 'published' ? 'archived' : 'published' }).eq('id', a.id); setMsg(error ? 'Could not update' : ''); load() }
  const inp = 'border rounded p-2'
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Announcements</h1>
    <form onSubmit={create} className="bg-white rounded-2xl p-4 grid md:grid-cols-3 gap-2"><input name="title" placeholder="Title" className={inp} aria-label="Title" />
      <select name="kind" className={inp} aria-label="Type"><option>general</option><option>exam reminder</option><option>assignment reminder</option></select>
      <select name="class_id" className={inp} aria-label="Class"><option value="">All classes</option>{classes.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select name="subject_id" className={inp} aria-label="Subject"><option value="">All subjects</option>{subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <textarea name="body" placeholder="Message" className={inp + ' md:col-span-2'} aria-label="Message" /><button className="bg-navy text-white rounded p-2 md:col-span-3">Publish</button></form>
    {msg && <p role="status">{msg}</p>}{list.length === 0 ? <p>No announcements yet.</p> : <ul className="bg-white rounded-2xl p-4">{list.map(a => <li key={a.id} className="flex gap-3 border-b py-1"><span className="flex-1">{a.title} · {a.kind} · {a.classes?.name ?? 'all classes'} · {a.subjects?.name ?? 'all subjects'} · {a.status}</span>
      <button className="underline" onClick={() => edit(a)}>Edit</button><button className="underline" onClick={() => toggle(a)}>{a.status === 'published' ? 'Archive' : 'Re-publish'}</button></li>)}</ul>}</div>
}
