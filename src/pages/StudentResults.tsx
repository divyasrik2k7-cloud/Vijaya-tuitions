import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type Result = {
  score: number
  remarks: string | null
  assessments: {
    id: string
    title: string
    max_marks: number
    held_on: string
    subjects?: { name: string } | null
  } | null
}

export default function StudentResults() {
  const [items, setItems] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subject, setSubject] = useState('all')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      const { data, error: queryError } = await supabase
        .from('assessment_marks')
        .select('score,remarks,assessments!inner(id,title,max_marks,held_on,subjects(name))')
      if (!active) return
      if (queryError) setError('Results could not be loaded. Please try again.')
      const normalized = (data ?? []).map((row: any) => ({
        ...row,
        assessments: Array.isArray(row.assessments) ? row.assessments[0] : row.assessments,
      })) as Result[]
      setItems(normalized)
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  const subjects = useMemo(() => Array.from(new Set(items.map(x => x.assessments?.subjects?.name).filter(Boolean))) as string[], [items])
  const visible = items.filter(x => subject === 'all' || x.assessments?.subjects?.name === subject)
  const average = visible.length
    ? visible.reduce((sum, x) => sum + (x.assessments?.max_marks ? (x.score / x.assessments.max_marks) * 100 : 0), 0) / visible.length
    : 0

  return (
    <div className="space-y-6">
      <header className="page-heading">
        <p className="eyebrow">YOUR PROGRESS</p>
        <h1 className="page-title">Results & feedback</h1>
        <p className="page-description">Review released assessment marks and teacher remarks.</p>
      </header>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {!loading && items.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="surface-card p-5">
            <p className="text-sm text-slate-500">Assessments released</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{visible.length}</p>
          </div>
          <div className="surface-card p-5">
            <p className="text-sm text-slate-500">Average percentage</p>
            <p className="mt-2 text-3xl font-extrabold text-violet-700">{average.toFixed(1)}%</p>
          </div>
        </section>
      )}
      <section className="surface-card p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assessment history</h2>
            <p className="text-sm text-slate-500">Only results released by your teacher are shown.</p>
          </div>
          <label className="text-sm font-medium text-slate-600">
            Subject
            <select value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 sm:min-w-48">
              <option value="all">All subjects</option>
              {subjects.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
        </div>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading results…</p> :
          visible.length === 0 ? <div className="py-8 text-center"><p className="font-semibold text-slate-700">No released results yet</p><p className="mt-1 text-sm text-slate-500">Your teacher's published results will appear here.</p></div> :
          <div className="divide-y divide-slate-100">
            {visible.map((item, index) => {
              const a = item.assessments
              const percent = a?.max_marks ? Math.round((item.score / a.max_marks) * 100) : 0
              return <article key={`${a?.id ?? index}-${index}`} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{a?.title ?? 'Assessment'}</p>
                  <p className="mt-1 text-xs text-slate-500">{a?.subjects?.name ?? 'General'} · {a?.held_on ? new Date(`${a.held_on}T00:00:00`).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : ''}</p>
                  {item.remarks && <p className="mt-2 text-sm text-slate-600">{item.remarks}</p>}
                </div>
                <div className="shrink-0 sm:text-right">
                  <p className="text-lg font-extrabold text-slate-900">{item.score} <span className="text-sm font-medium text-slate-400">/ {a?.max_marks ?? '—'}</span></p>
                  <p className="text-xs font-semibold text-violet-700">{percent}%</p>
                </div>
              </article>
            })}
          </div>}
      </section>
    </div>
  )
}
