import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Announcement = {
  id: string
  title: string
  body: string
  kind: string
  created_at: string
  classes?: { name: string } | { name: string }[] | null
  subjects?: { name: string } | { name: string }[] | null
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default function StudentAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      const { data, error: queryError } = await supabase
        .from('announcements')
        .select('id,title,body,kind,created_at,classes(name),subjects(name)')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(100)
      if (!active) return
      if (queryError) setError('Announcements could not be loaded. Please refresh and try again.')
      setItems(data ?? [])
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  return (
    <div className="space-y-6">
      <header className="page-heading">
        <p className="eyebrow">STAY IN THE LOOP</p>
        <h1 className="page-title">Announcements</h1>
        <p className="page-description">Important updates and reminders from your teacher.</p>
      </header>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {loading ? (
        <div className="surface-card p-8 text-center text-slate-500">Loading announcements…</div>
      ) : items.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <div className="text-4xl">📣</div>
          <h2 className="mt-3 text-lg font-bold text-slate-800">You're all caught up</h2>
          <p className="mt-1 text-sm text-slate-500">New announcements from your teacher will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map(item => (
            <article key={item.id} className="surface-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold capitalize text-violet-700">{item.kind || 'General'}</span>
                <time className="text-xs text-slate-500" dateTime={item.created_at}>
                  {new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </time>
              </div>
              <h2 className="mt-3 text-lg font-bold text-slate-900">{item.title}</h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{item.body}</p>
              {(relationOne(item.classes)?.name || relationOne(item.subjects)?.name) && (
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs font-medium text-slate-500">
                  {[relationOne(item.classes)?.name, relationOne(item.subjects)?.name].filter(Boolean).join(' · ')}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
