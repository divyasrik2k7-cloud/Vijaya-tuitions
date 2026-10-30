import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function StudentTests() {
  const [tests, setTests] = useState<any[]>([])
  const [atts, setAtts] = useState<Record<string, any>>({})
  const [act, setAct] = useState<any>(null)
  const [idx, setIdx] = useState(0)
  const [ans, setAns] = useState<Record<string, string>>({})
  const [left, setLeft] = useState(0)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)

    const [t, a] = await Promise.all([
      supabase
        .from('online_tests')
        .select(
          'id,title,duration_minutes,available_from,available_until,subjects(name)',
        )
        .order('available_from', { ascending: false }),
      supabase
        .from('test_attempts')
        .select('test_id,submitted_at,test_results(score,max_score)'),
    ])

    setTests(t.data ?? [])
    setAtts(Object.fromEntries((a.data ?? []).map(x => [x.test_id, x])))
    setLoading(false)

    if (t.error || a.error) {
      setMsg('Some test information could not be loaded. Please refresh.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function start(t: any) {
    setMsg('')

    const r = await supabase.rpc('start_test', { p_test: t.id })

    if (r.error) {
      setMsg(
        r.error.message.includes('window')
          ? 'This test is not open right now.'
          : 'Could not start this test. Please try again.',
      )
      return
    }

    const [a, q] = await Promise.all([
      supabase
        .from('test_attempts')
        .select('started_at')
        .eq('id', r.data)
        .single(),
      supabase
        .from('test_questions')
        .select('id,body,marks,position,test_options(id,body,position)')
        .eq('test_id', t.id)
        .order('position'),
    ])

    if (a.error || q.error) {
      setMsg('Could not load test questions. Please try again.')
      return
    }

    const attemptEnds =
      new Date(a.data.started_at).getTime() + t.duration_minutes * 60000

    setAns({})
    setIdx(0)
    setLeft(Math.max(0, Math.ceil((attemptEnds - Date.now()) / 1000)))

    setAct({
      attempt: r.data,
      test: t,
      ends: attemptEnds,
      qs: q.data ?? [],
    })
  }

  async function submit() {
    if (!act || submitting) return

    setSubmitting(true)
    const attempt = act.attempt

    const r = await supabase.rpc('submit_test', {
      p_attempt: attempt,
      p_answers: ans,
    })

    setAct(null)
    setSubmitting(false)

    setMsg(
      r.error
        ? 'Submission was rejected. The test may have expired or already been submitted.'
        : '🎉 Test submitted successfully! Your teacher will release your results.',
    )

    await load()
  }

  const submitRef = useRef(submit)
  submitRef.current = submit

  useEffect(() => {
    if (!act) return

    const timer = window.setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil((act.ends - Date.now()) / 1000),
      )

      setLeft(seconds)

      if (seconds === 0) {
        window.clearInterval(timer)
        void submitRef.current()
      }
    }, 500)

    return () => window.clearInterval(timer)
  }, [act])

  const now = Date.now()

  const getResult = (attempt: any) =>
    attempt &&
    (Array.isArray(attempt.test_results)
      ? attempt.test_results[0]
      : attempt.test_results)

  const isOpen = (test: any) =>
    new Date(test.available_from).getTime() <= now &&
    now <= new Date(test.available_until).getTime()

  const getTestStatus = (test: any) => {
    const attempt = atts[test.id]

    if (attempt?.submitted_at) return 'completed'
    if (attempt) return 'resume'
    if (isOpen(test)) return 'available'
    if (now < new Date(test.available_from).getTime()) return 'upcoming'

    return 'closed'
  }

  const statusDetails: Record<
    string,
    { label: string; style: string; icon: string }
  > = {
    available: {
      label: 'Available now',
      style: 'bg-emerald-100 text-emerald-700',
      icon: '🟢',
    },
    upcoming: {
      label: 'Coming soon',
      style: 'bg-sky-100 text-sky-700',
      icon: '🗓️',
    },
    resume: {
      label: 'In progress',
      style: 'bg-amber-100 text-amber-700',
      icon: '✏️',
    },
    completed: {
      label: 'Completed',
      style: 'bg-violet-100 text-violet-700',
      icon: '✅',
    },
    closed: {
      label: 'Closed',
      style: 'bg-slate-100 text-slate-600',
      icon: '🔒',
    },
  }

  const filteredTests = tests.filter(test => {
    const status = getTestStatus(test)
    const matchesFilter = filter === 'all' || status === filter
    const matchesSearch =
      `${test.title} ${test.subjects?.name ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase())

    return matchesFilter && matchesSearch
  })

  const completedCount = tests.filter(
    test => getTestStatus(test) === 'completed',
  ).length

  const availableCount = tests.filter(test =>
    ['available', 'resume'].includes(getTestStatus(test)),
  ).length

  const upcomingCount = tests.filter(
    test => getTestStatus(test) === 'upcoming',
  ).length

  // Active test interface
  if (act) {
    const q = act.qs[idx]
    const sortedOptions = q
      ? [...(q.test_options ?? [])].sort(
          (a: any, b: any) => a.position - b.position,
        )
      : []

    const answeredCount = Object.keys(ans).length
    const progress = act.qs.length
      ? (answeredCount / act.qs.length) * 100
      : 0

    return (
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-r from-violet-700 to-purple-500 p-5 text-white shadow-lg sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-white/75">
                ✨ FOCUS TIME
              </span>
              <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
                {act.test.title}
              </h1>
              <p className="mt-2 text-sm text-white/80">
                {act.test.subjects?.name ?? 'Online assessment'}
              </p>
            </div>

            <div
              className={`rounded-2xl px-4 py-3 text-center ${
                left <= 60 ? 'bg-rose-500' : 'bg-white/15'
              }`}
              aria-live="polite"
            >
              <p className="text-xs text-white/80">TIME LEFT</p>
              <p className="mt-1 font-mono text-2xl font-extrabold">
                {Math.floor(left / 60)
                  .toString()
                  .padStart(2, '0')}
                :{String(left % 60).padStart(2, '0')}
              </p>
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-amber-300 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-2 flex justify-between gap-3 text-xs text-white/80">
            <span>
              {answeredCount} of {act.qs.length} answered
            </span>
            <span>
              Question {act.qs.length ? idx + 1 : 0} of {act.qs.length}
            </span>
          </div>
        </section>

        {act.qs.length === 0 ? (
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">📭</div>
            <h2 className="mt-3 text-lg font-bold text-slate-800">
              No questions found
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              This test currently has no questions.
            </p>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700">
                  QUESTION {idx + 1}
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                  ⭐ {q.marks} marks
                </span>
              </div>

              <h2 className="mt-6 whitespace-pre-wrap break-words text-lg font-bold leading-8 text-slate-800 sm:text-xl">
                {q.body}
              </h2>

              <p className="mt-2 text-xs text-slate-400">
                Choose one answer.
              </p>

              <div className="mt-6 space-y-3">
                {sortedOptions.map((option: any, optionIndex: number) => {
                  const selected = ans[q.id] === option.id

                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                        selected
                          ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-100'
                          : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected}
                        onChange={() =>
                          setAns(previous => ({
                            ...previous,
                            [q.id]: option.id,
                          }))
                        }
                        className="mt-1 h-4 w-4 accent-violet-600"
                      />

                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                          selected
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {String.fromCharCode(65 + optionIndex)}
                      </span>

                      <span className="flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                        {option.body}
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <button
                type="button"
                disabled={idx === 0 || submitting}
                onClick={() => setIdx(previous => previous - 1)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>

              <span className="text-xs text-slate-500">
                {answeredCount}/{act.qs.length} answered
              </span>

              {idx < act.qs.length - 1 ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIdx(previous => previous + 1)}
                  className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                >
                  Next question →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Submit your test? ${answeredCount} of ${act.qs.length} questions answered.`,
                      )
                    ) {
                      void submit()
                    }
                  }}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : '✓ Submit test'}
                </button>
              )}
            </section>
          </>
        )}
      </div>
    )
  }

  // Student test library
  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
            🎯 YOUR NEXT CHALLENGE
          </span>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Online Test Centre
          </h1>

          <p className="mt-3 max-w-lg text-sm leading-6 text-white/90 sm:text-base">
            Believe in yourself, take a deep breath, and give every question
            your best shot. You’ve got this!
          </p>
        </div>

        <div className="pointer-events-none absolute -right-2 -top-5 text-8xl opacity-20 sm:right-12 sm:top-1 sm:text-9xl">
          🧠
        </div>
        <div className="pointer-events-none absolute bottom-4 right-24 text-4xl opacity-30">
          ⭐
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-800">Ready to take</p>
              <p className="mt-2 text-3xl font-extrabold text-emerald-950">
                {availableCount}
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">
              🚀
            </span>
          </div>
          <p className="mt-3 text-xs text-emerald-700">Available tests and attempts</p>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-violet-800">Completed</p>
              <p className="mt-2 text-3xl font-extrabold text-violet-950">
                {completedCount}
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">
              🏆
            </span>
          </div>
          <p className="mt-3 text-xs text-violet-700">Tests you have submitted</p>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-sky-800">Coming soon</p>
              <p className="mt-2 text-3xl font-extrabold text-sky-950">
                {upcomingCount}
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">
              📅
            </span>
          </div>
          <p className="mt-3 text-xs text-sky-700">Tests opening in the future</p>
        </div>
      </section>

      {msg && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800"
        >
          {msg}
        </div>
      )}

      <section>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-500">
              PRACTICE & PROGRESS
            </p>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-800">
              Your tests
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Check availability, continue an attempt, or view your results.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search tests..."
              aria-label="Search tests"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:w-48"
            />

            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              aria-label="Filter tests"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="all">All tests</option>
              <option value="available">Available now</option>
              <option value="resume">In progress</option>
              <option value="upcoming">Coming soon</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
            <p className="text-sm text-slate-500">Loading your tests...</p>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-blue-200 bg-white p-10 text-center">
            <div className="text-5xl">🧠</div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">
              {tests.length === 0 ? 'No tests just yet!' : 'No matching tests'}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {tests.length === 0
                ? 'When your teacher publishes an online test, it will appear here.'
                : 'Try changing your search or selecting another filter.'}
            </p>
            {(search || filter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setFilter('all')
                }}
                className="mt-4 rounded-xl bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200"
              >
                Show all tests
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {filteredTests.map((test, index) => {
              const attempt = atts[test.id]
              const result = getResult(attempt)
              const status = getTestStatus(test)
              const details = statusDetails[status]
              const accent = [
                'from-violet-500 to-fuchsia-400',
                'from-sky-500 to-blue-400',
                'from-emerald-500 to-teal-400',
                'from-amber-500 to-orange-400',
              ][index % 4]

              return (
                <article
                  key={test.id}
                  className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className={`h-1.5 bg-gradient-to-r ${accent}`} />

                  <div className="space-y-5 p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-2xl">
                        {['🧠', '📘', '✏️', '🎯'][index % 4]}
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-blue-600">
                          {test.subjects?.name ?? 'General assessment'}
                        </span>
                        <h3 className="mt-1 break-words text-lg font-bold text-slate-800">
                          {test.title}
                        </h3>
                      </div>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${details.style}`}
                    >
                      {details.icon} {details.label}
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">⏱️ Duration</p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {test.duration_minutes} minutes
                        </p>
                      </div>

                      <div className="rounded-xl bg-sky-50 p-3">
                        <p className="text-xs text-sky-700">🗓️ Opens</p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {new Date(test.available_from).toLocaleDateString(
                            undefined,
                            { day: 'numeric', month: 'short' },
                          )}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(test.available_from).toLocaleTimeString(
                            undefined,
                            { hour: 'numeric', minute: '2-digit' },
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs leading-5 text-slate-500">
                      <span className="font-semibold text-slate-600">
                        Available until:
                      </span>{' '}
                      {new Date(test.available_until).toLocaleString()}
                    </div>

                    {attempt?.submitted_at ? (
                      <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
                        {result ? (
                          <>
                            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
                              🏆 Your result
                            </p>
                            <p className="mt-1 text-2xl font-extrabold text-violet-900">
                              {result.score} / {result.max_score}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm font-medium text-violet-800">
                            📬 Submitted successfully. Your results are pending.
                          </p>
                        )}
                      </div>
                    ) : null}

                    {['available', 'resume'].includes(status) ? (
                      <button
                        type="button"
                        onClick={() => void start(test)}
                        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:from-blue-700 hover:to-violet-700"
                      >
                        {status === 'resume'
                          ? 'Continue test →'
                          : 'Start test 🚀'}
                      </button>
                    ) : status === 'upcoming' ? (
                      <div className="rounded-xl bg-sky-50 p-3 text-center text-sm font-medium text-sky-700">
                        🗓️ This test will open at the scheduled time.
                      </div>
                    ) : status === 'closed' ? (
                      <div className="rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-500">
                        🔒 The test window has closed.
                      </div>
                    ) : null}
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
