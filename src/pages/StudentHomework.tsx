import { useEffect, useState, type ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { validateFile, safeName } from '../lib/files'
import { openFile } from '../lib/storage'

export default function StudentHomework() {
  const [me, setMe] = useState<string | null>(null)
  const [items, setItems] = useState<any[]>([])
  const [subs, setSubs] = useState<Record<string, any>>({})
  const [mats, setMats] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)

    const [p, a, s, m] = await Promise.all([
      supabase.from('student_profiles').select('id').maybeSingle(),
      supabase
        .from('assignments')
        .select('id,title,instructions,due_at,max_marks,material_id,subjects(name)')
        .order('due_at'),
      supabase
        .from('assignment_submissions')
        .select('assignment_id,status,marks,feedback,file_name'),
      supabase.from('learning_materials').select('id,storage_path'),
    ])

    setMe(p.data?.id ?? null)
    setItems(a.data ?? [])
    setSubs(Object.fromEntries((s.data ?? []).map(x => [x.assignment_id, x])))
    setMats(Object.fromEntries((m.data ?? []).map(x => [x.id, x.storage_path])))
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function submit(a: any, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''

    if (!file || !me) return

    setMsg('')

    const fe =
      validateFile(file) ??
      (/\.(pdf|docx?|txt|png|jpe?g)$/i.test(file.name)
        ? null
        : 'Submissions must be PDF, Word, text or image files')

    if (fe) {
      setMsg(fe)
      return
    }

    if (new Date(a.due_at) < new Date()) {
      setMsg('The deadline has passed.')
      return
    }

    setUploading(a.id)

    try {
      const path = `${me}/${a.id}/${safeName(file.name)}`

      const up = await supabase.storage
        .from('submissions')
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
        })

      if (up.error) {
        setMsg('Upload failed. Please try again.')
        return
      }

      const { error } = await supabase
        .from('assignment_submissions')
        .upsert(
          {
            assignment_id: a.id,
            student_id: me,
            storage_path: path,
            file_name: file.name,
            submitted_at: new Date().toISOString(),
          },
          { onConflict: 'assignment_id,student_id' },
        )

      if (error) {
        setMsg('Could not submit. The submission may already be reviewed or the deadline may have passed.')
        return
      }

      setMsg('🎉 Homework submitted successfully!')
      await load()
    } catch {
      setMsg('Something went wrong. Please try again.')
    } finally {
      setUploading(null)
    }
  }

  const now = Date.now()

  const getLate = (a: any) => new Date(a.due_at).getTime() < now

  const getStatus = (a: any) => {
    const submission = subs[a.id]

    if (submission) return submission.status?.toLowerCase() ?? 'submitted'
    return getLate(a) ? 'missed' : 'pending'
  }

  const filteredItems = items.filter(a => {
    const status = getStatus(a)
    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending' && status === 'pending') ||
      (filter === 'submitted' && ['submitted', 'reviewed', 'graded'].includes(status)) ||
      (filter === 'missed' && status === 'missed')

    const text = `${a.title} ${a.subjects?.name ?? ''}`.toLowerCase()
    return matchesFilter && text.includes(search.toLowerCase())
  })

  const pendingCount = items.filter(a => getStatus(a) === 'pending').length
  const submittedCount = items.filter(a =>
    ['submitted', 'reviewed', 'graded'].includes(getStatus(a)),
  ).length
  const missedCount = items.filter(a => getStatus(a) === 'missed').length

  const statusStyle: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    submitted: 'bg-sky-100 text-sky-700',
    reviewed: 'bg-emerald-100 text-emerald-700',
    graded: 'bg-emerald-100 text-emerald-700',
    missed: 'bg-rose-100 text-rose-700',
  }

  const statusLabel: Record<string, string> = {
    pending: '⏳ Pending',
    submitted: '📤 Submitted',
    reviewed: '✅ Reviewed',
    graded: '🏆 Graded',
    missed: '⚠️ Deadline passed',
  }

  return (
    <div className="space-y-7">
      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
            ✨ YOUR LEARNING SPACE
          </span>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Homework Hub 📚
          </h1>

          <p className="mt-3 max-w-lg text-sm leading-6 text-white/90 sm:text-base">
            Every assignment is a chance to learn something new. Keep going,
            submit on time, and be proud of your progress!
          </p>
        </div>

        <div className="pointer-events-none absolute -right-3 -top-8 text-8xl opacity-20 sm:right-10 sm:top-0 sm:text-9xl">
          🎒
        </div>
        <div className="pointer-events-none absolute bottom-2 right-24 text-4xl opacity-30">
          ⭐
        </div>
      </section>

      {/* Summary cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800">To complete</p>
              <p className="mt-2 text-3xl font-extrabold text-amber-950">
                {pendingCount}
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">
              ✏️
            </span>
          </div>
          <p className="mt-3 text-xs text-amber-700">Your next learning goals</p>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-sky-800">Submitted</p>
              <p className="mt-2 text-3xl font-extrabold text-sky-950">
                {submittedCount}
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">
              📤
            </span>
          </div>
          <p className="mt-3 text-xs text-sky-700">Work you've turned in</p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-rose-800">Missed deadlines</p>
              <p className="mt-2 text-3xl font-extrabold text-rose-950">
                {missedCount}
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">
              📅
            </span>
          </div>
          <p className="mt-3 text-xs text-rose-700">Assignments past their deadline</p>
        </div>
      </section>

      {/* Homework list */}
      <section>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-500">
              YOUR ASSIGNMENTS
            </p>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-800">
              Let's get things done!
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              View instructions, submit files, and check teacher feedback.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search homework..."
              aria-label="Search homework"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 sm:w-52"
            />

            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              aria-label="Filter homework"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
            >
              <option value="all">All assignments</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="missed">Missed deadlines</option>
            </select>
          </div>
        </div>

        {msg && (
          <div
            role="status"
            className={`mb-5 rounded-xl border p-4 text-sm font-medium ${
              msg.includes('successfully')
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {msg}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="text-sm text-slate-500">Loading your homework...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-violet-200 bg-white p-10 text-center">
            <div className="text-5xl">📚</div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">
              {items.length === 0
                ? 'No homework yet!'
                : 'No matching assignments'}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {items.length === 0
                ? 'Your teacher has not assigned homework yet. Check back soon!'
                : 'Try another search term or change the status filter.'}
            </p>
            {filter !== 'all' || search ? (
              <button
                type="button"
                onClick={() => {
                  setFilter('all')
                  setSearch('')
                }}
                className="mt-4 rounded-xl bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-200"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {filteredItems.map(a => {
              const s = subs[a.id]
              const late = getLate(a)
              const status = getStatus(a)
              const canSubmit =
                (!s || s.status === 'submitted') &&
                !late &&
                !['reviewed', 'graded'].includes(status)

              return (
                <article
                  key={a.id}
                  className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="h-1.5 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-sky-400" />

                  <div className="space-y-4 p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-50 text-2xl">
                        📘
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                          {a.subjects?.name ?? 'General subject'}
                        </span>
                        <h3 className="mt-1 break-words text-lg font-bold text-slate-800">
                          {a.title}
                        </h3>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          statusStyle[status] ?? statusStyle.pending
                        }`}
                      >
                        {statusLabel[status] ?? status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">📅 Deadline</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {a.due_at
                            ? new Date(a.due_at).toLocaleDateString(undefined, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'Not specified'}
                        </p>
                        {a.due_at && (
                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(a.due_at).toLocaleTimeString(undefined, {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl bg-amber-50 p-3">
                        <p className="text-xs text-amber-700">🏆 Total marks</p>
                        <p className="mt-1 text-sm font-semibold text-amber-900">
                          {a.max_marks != null ? a.max_marks : 'Not specified'}
                        </p>
                      </div>
                    </div>

                    {a.instructions && (
                      <div className="rounded-xl bg-sky-50 p-4">
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-sky-700">
                          📝 Instructions
                        </p>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                          {a.instructions}
                        </p>
                      </div>
                    )}

                    {mats[a.material_id] && (
                      <button
                        type="button"
                        onClick={async () => {
                          setMsg('')
                          
                          if (!(await openFile('materials', mats[a.material_id]))) {
                            setMsg('Could not open the reference material.')
                          }
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-left transition hover:bg-violet-100"
                      >
                        <span className="text-2xl">📎</span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-violet-800">
                            Reference material
                          </span>
                          <span className="mt-0.5 block text-xs text-violet-600">
                            Open the study file provided by your teacher
                          </span>
                        </span>
                        <span className="text-lg text-violet-600">↗</span>
                      </button>
                    )}

                    {s?.file_name && (
                      <div className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 p-3">
                        <span className="text-2xl">📄</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-sky-700">
                            Your submitted file
                          </p>
                          <p className="break-all text-sm font-semibold text-slate-700">
                            {s.file_name}
                          </p>
                        </div>
                      </div>
                    )}

                    {s?.marks != null && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                          🌟 Your result
                        </p>
                        <p className="mt-1 text-2xl font-extrabold text-emerald-800">
                          {s.marks}
                          {a.max_marks != null ? ` / ${a.max_marks}` : ' marks'}
                        </p>
                      </div>
                    )}

                    {s?.feedback && (
                      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">
                          💬 Teacher's feedback
                        </p>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-amber-900">
                          {s.feedback}
                        </p>
                      </div>
                    )}

                    {canSubmit && (
                      <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/70 p-5 text-center transition hover:border-violet-400 hover:bg-violet-50">
                        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">
                          {uploading === a.id ? '⏳' : '📤'}
                        </span>
                        <span className="mt-3 block text-sm font-bold text-violet-800">
                          {uploading === a.id
                            ? 'Uploading your work...'
                            : s
                              ? 'Upload a revised submission'
                              : 'Upload your homework'}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          PDF, Word, TXT, PNG or JPG
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                          disabled={uploading !== null}
                          onChange={e => void submit(a, e)}
                          aria-label={`Upload submission for ${a.title}`}
                          className="mt-3 block w-full cursor-pointer text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:font-semibold file:text-white hover:file:bg-violet-700 disabled:opacity-50"
                        />
                      </label>
                    )}

                    {late && !s && (
                      <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                        ⏰ The deadline has passed, so new submissions are closed.
                      </div>
                    )}

                    {['reviewed', 'graded'].includes(status) && (
                      <div className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                        ✅ This submission has been reviewed.
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
