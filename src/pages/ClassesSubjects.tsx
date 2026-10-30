import { useEffect, useState, FormEvent } from 'react'
import { supabase } from '../lib/supabase'
function Manager({ table, label }: { table: 'classes' | 'subjects'; label: string }) {
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]); const [name, setName] = useState(''); const [msg, setMsg] = useState('')
  const load = async () => { const { data } = await supabase.from(table).select('id,name').order('name'); setRows(data ?? []) }
  useEffect(() => { load() }, [])
  const report = (error: { code?: string } | null) => setMsg(error ? (error.code === '23505' ? `That ${label} already exists` : 'Could not save') : '')
  async function add(e: FormEvent) { e.preventDefault(); const n = name.trim(); if (!n) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from(table).insert({ name: n, teacher_id: user!.id }); report(error); if (!error) setName(''); load() }
  async function rename(r: { id: string; name: string }) { const n = prompt(`Rename ${label}`, r.name)?.trim(); if (!n || n === r.name) return
    const { error } = await supabase.from(table).update({ name: n }).eq('id', r.id); report(error); load() }
  return <section className="bg-white rounded-2xl p-4 space-y-3"><h2 className="font-semibold capitalize">{label}s</h2>
    <form onSubmit={add} className="flex gap-2"><input value={name} onChange={e => setName(e.target.value)} placeholder={`New ${label}`} aria-label={`New ${label}`} className="border rounded p-2 flex-1" /><button className="bg-navy text-white rounded px-3">Add</button></form>
    {msg && <p role="alert" className="text-sm">{msg}</p>}
    {rows.length === 0 ? <p className="text-slate-500">No {label}s yet.</p> : <ul>{rows.map(r => <li key={r.id} className="flex justify-between border-b py-1">{r.name}<button className="underline" onClick={() => rename(r)}>Rename</button></li>)}</ul>}</section>
}
export default function ClassesSubjects() {
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Classes &amp; subjects</h1><div className="grid md:grid-cols-2 gap-4"><Manager table="classes" label="class" /><Manager table="subjects" label="subject" /></div></div>
}
