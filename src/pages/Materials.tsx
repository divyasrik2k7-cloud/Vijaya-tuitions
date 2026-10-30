import { useEffect, useState, FormEvent } from 'react'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validateFile, safeName } from '../lib/files'
import { openFile } from '../lib/storage'
type Opt = { id: string; name: string }
const schema = z.object({ title: z.string().trim().min(1, 'Title required'), subject_id: z.string().min(1, 'Choose a subject'), class_id: z.string().min(1, 'Choose a class') })
export default function Materials() {
  const [subjects, setSubjects] = useState<Opt[]>([]); const [classes, setClasses] = useState<Opt[]>([]); const [list, setList] = useState<any[]>([]); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  const load = async () => { const { data } = await supabase.from('learning_materials').select('id,title,description,published,storage_path,file_name,subjects(name),classes(name)').order('created_at', { ascending: false }); setList(data ?? []) }
  useEffect(() => { load(); supabase.from('subjects').select('id,name').order('name').then(r => setSubjects(r.data ?? [])); supabase.from('classes').select('id,name').order('name').then(r => setClasses(r.data ?? [])) }, [])
  async function upload(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (busy) return; const form = e.currentTarget; const fd = new FormData(form)
    const p = schema.safeParse({ title: fd.get('title'), subject_id: fd.get('subject_id'), class_id: fd.get('class_id') }); if (!p.success) return setMsg(p.error.issues[0].message)
    const file = fd.get('file') as File; if (!file || !file.name) return setMsg('Choose a file'); const fe = validateFile(file); if (fe) return setMsg(fe)
    setBusy(true); const { data: { user } } = await supabase.auth.getUser(); const path = `${user!.id}/${crypto.randomUUID()}-${safeName(file.name)}`
    const up = await supabase.storage.from('materials').upload(path, file, { contentType: file.type })
    if (up.error) { setBusy(false); return setMsg('Upload failed') }
    const { error } = await supabase.from('learning_materials').insert({ ...p.data, description: (fd.get('description') as string) || null, teacher_id: user!.id, storage_path: path, file_name: file.name })
    if (error) await supabase.storage.from('materials').remove([path])
    setMsg(error ? 'Could not save material' : 'Uploaded (unpublished until you publish it)'); setBusy(false); if (!error) { form.reset(); load() } }
  async function toggle(m: any) { const { error } = await supabase.from('learning_materials').update({ published: !m.published }).eq('id', m.id); setMsg(error ? 'Could not update' : ''); load() }
  async function edit(m: any) { const t = prompt('Title', m.title)?.trim(); if (!t) return; const d = prompt('Description', m.description ?? '')
    const { error } = await supabase.from('learning_materials').update({ title: t, description: d?.trim() || null }).eq('id', m.id); setMsg(error ? 'Could not update' : ''); load() }
  const inp = 'border rounded p-2'
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Study materials</h1>
    <form onSubmit={upload} className="bg-white rounded-2xl p-4 grid md:grid-cols-2 gap-2"><input name="title" placeholder="Title" className={inp} aria-label="Title" /><input name="description" placeholder="Description (optional)" className={inp} aria-label="Description" />
      <select name="subject_id" className={inp} aria-label="Subject"><option value="">Subject</option>{subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select name="class_id" className={inp} aria-label="Class"><option value="">Class</option>{classes.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <input name="file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg" className={inp} aria-label="File" /><button disabled={busy} className="bg-navy text-white rounded p-2">{busy ? 'Uploading…' : 'Upload'}</button></form>
    {msg && <p role="status">{msg}</p>}
    {list.length === 0 ? <p>No materials yet.</p> : <ul className="bg-white rounded-2xl p-4">{list.map(m => <li key={m.id} className="flex flex-wrap gap-3 border-b py-1"><span className="flex-1">{m.title} · {m.subjects?.name} · {m.classes?.name} · {m.published ? 'Published' : 'Draft'}</span>
      <button className="underline" onClick={async () => { if (!(await openFile('materials', m.storage_path))) setMsg('Could not open file') }}>Open</button><button className="underline" onClick={() => edit(m)}>Edit</button><button className="underline" onClick={() => toggle(m)}>{m.published ? 'Unpublish' : 'Publish'}</button></li>)}</ul>}</div>
}
