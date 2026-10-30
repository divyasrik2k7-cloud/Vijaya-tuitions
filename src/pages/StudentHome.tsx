import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { attendancePercent, type Status } from '../lib/attendance'

interface StudentInfo {
  school_name: string | null
  guardian_name: string | null
  enrolled_on: string | null
  classes: { name: string } | null
}

interface Subject {
  name: string
}

interface Assessment {
  title: string
  max_marks: number
  held_on: string | null
  subjects: Subject | null
}

interface Mark {
  score: number
  remarks: string | null
  assessments: Assessment
}

interface Announcement {
  id: string
  title: string
  body: string
  kind: string
  created_at: string
}

interface AttendanceRecord {
  attended_on: string
  status: Status
}

const navigation = [
  { to: '/student', label: 'Home', icon: '🏠' },
  { to: '/student/materials', label: 'Study Materials', icon: '📚' },
  { to: '/student/homework', label: 'Homework', icon: '✏️' },
  { to: '/student/tests', label: 'Online Tests', icon: '📝' },
]

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function StudentHome() {
  const [name, setName] = useState('')
  const [info, setInfo] = useState<StudentInfo | null>(null)
  const [subs, setSubs] = useState<string[]>([])
  const [marks, setMarks] = useState<Mark[]>([])
  const [anns, setAnns] = useState<Announcement[]>([])
  const [att, setAtt] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      try {
        const [
          profileResult,
          subjectsResult,
          marksResult,
          announcementsResult,
          attendanceResult,
        ] = await Promise.all([
          supabase
            .from('student_profiles')
            .select('full_name,school_name,guardian_name,enrolled_on,classes(name)')
            .maybeSingle(),

          supabase
            .from('student_subjects')
            .select('subjects(name)'),

          supabase
            .from('assessment_marks')
            .select('score,remarks,assessments(title,max_marks,held_on,subjects(name))'),

          supabase
            .from('announcements')
            .select('id,title,body,kind,created_at')
            .order('created_at', { ascending: false })
            .limit(10),

          supabase
            .from('attendance')
            .select('attended_on,status')
            .order('attended_on', { ascending: false }),
        ])

        if (!active) return

        if (profileResult.error) {
          setError('We could not load your profile. Please refresh the page.')
          return
        }

        const profile = profileResult.data as unknown as
          (StudentInfo & { full_name: string }) | null

        setName(profile?.full_name ?? 'Student')
        setInfo(profile)

        setSubs(
          ((subjectsResult.data ?? []) as unknown as {
            subjects: Subject | null
          }[])
            .map(item => item.subjects?.name)
            .filter((subject): subject is string => Boolean(subject)),
        )

        setMarks(
          ((marksResult.data ?? []) as unknown as Mark[])
            .filter(item => item.assessments),
        )

        setAnns((announcementsResult.data ?? []) as Announcement[])
        setAtt((attendanceResult.data ?? []) as AttendanceRecord[])

        if (
          subjectsResult.error ||
          marksResult.error ||
          announcementsResult.error ||
          attendanceResult.error
        ) {
          setError('Some dashboard information could not be loaded.')
        }
      } catch {
        if (active) {
          setError('Something went wrong while loading your dashboard.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [])

  const attendance = attendancePercent(att)
  const averageScore = marks.length
    ? Math.round(
        marks.reduce((sum, item) => {
          const max = Number(item.assessments.max_marks)
          return sum + (max > 0 ? (item.score / max) * 100 : 0)
        }, 0) / marks.length,
      )
    : null

  const latestMarks = [...marks]
    .sort((a, b) =>
      (b.assessments.held_on ?? '').localeCompare(
        a.assessments.held_on ?? '',
      ),
    )
    .slice(0, 4)

  async function logout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setError('Could not log out. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7FF] text-slate-800 md:flex">

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-indigo-100 bg-white p-5 md:flex">
        <Link to="/student" className="mb-9 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 text-2xl shadow-md shadow-sky-100">
            📚
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight text-indigo-950">
              Vijaya
            </p>
            <p className="text-xs font-medium text-slate-400">
              TUITION & LEARNING
            </p>
          </div>
        </Link>

        <p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">
          YOUR SPACE
        </p>

        <nav className="space-y-2">
          {navigation.map((item, index) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition hover:bg-indigo-50 hover:text-indigo-700 ${
                index === 0
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
              {index === 0 && (
                <span className="ml-auto h-2 w-2 rounded-full bg-indigo-500" />
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl bg-gradient-to-br from-sky-100 via-indigo-50 to-purple-100 p-4">
          <div className="mb-2 text-2xl">🌈</div>
          <p className="font-bold text-indigo-950">Keep learning!</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Every small step takes you closer to your goals.
          </p>
        </div>

        <button
          onClick={logout}
          className="mt-5 rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
        >
          ↪ Log out
        </button>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10">
        <div className="mx-auto max-w-6xl space-y-7">

          {/* Header */}
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Your learning space ✨
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-indigo-950 sm:text-3xl">
                My Dashboard
              </h1>
            </div>

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 to-orange-200 text-xl shadow-sm">
              🎓
            </div>
          </header>

          {/* Mobile navigation */}
          <nav className="grid grid-cols-4 gap-2 rounded-2xl border border-indigo-50 bg-white p-2 shadow-sm md:hidden">
            {navigation.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-1 rounded-xl px-1 py-3 text-center text-xs font-semibold text-slate-600 transition hover:bg-indigo-50"
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label === 'Study Materials' ? 'Materials' : item.label}</span>
              </Link>
            ))}
          </nav>

          {error && (
            <div
              role="status"
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-5" aria-live="polite">
              <div className="h-52 animate-pulse rounded-3xl bg-indigo-100" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[1, 2, 3, 4].map(item => (
                  <div
                    key={item}
                    className="h-32 animate-pulse rounded-3xl bg-white"
                  />
                ))}
              </div>
              <p className="text-center text-sm text-slate-500">
                Getting your learning space ready…
              </p>
            </div>
          ) : (
            <>
              {/* Welcome banner */}
              <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-500 p-6 text-white shadow-xl shadow-indigo-100 sm:p-9">
                <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute -bottom-20 right-32 h-48 w-48 rounded-full bg-white/10" />

                <div className="relative z-10 max-w-2xl">
                  <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                    ✨ YOUR SPACE TO GROW
                  </span>

                  <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
                    Hey, {name || 'Student'}! 👋
                  </h2>

                  <p className="mt-3 max-w-lg text-sm leading-6 text-white/90 sm:text-base">
                    Ready to learn something new today? Every lesson,
                    every question, and every effort helps you grow.
                  </p>

                  <Link
                    to="/student/materials"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    Explore study materials <span>→</span>
                  </Link>
                </div>

                <div className="pointer-events-none absolute bottom-5 right-7 hidden text-7xl drop-shadow-sm sm:block lg:right-12 lg:text-8xl">
                  🚀
                </div>
              </section>

              {/* Student details */}
              <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-50 bg-white p-4 shadow-sm sm:gap-5 sm:p-5">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-100 text-2xl">
                  🧑‍🎓
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-bold text-indigo-950">
                    {name || 'Your profile'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {info?.classes?.name ?? 'Class not assigned'}
                    {info?.school_name ? ` · ${info.school_name}` : ''}
                  </p>
                </div>

                <div className="rounded-xl bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700">
                  📖 {subs.length} {subs.length === 1 ? 'subject' : 'subjects'}
                </div>
              </section>

              {/* Stats */}
              <section>
                <div className="mb-4">
                  <h2 className="text-lg font-extrabold text-indigo-950">
                    Your learning at a glance
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Look how far you've come! 🌟
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                  <StatCard
                    icon="🎯"
                    label="Attendance"
                    value={`${attendance}%`}
                    note="Your attendance"
                    color="bg-sky-50"
                    iconColor="bg-sky-100"
                  />

                  <StatCard
                    icon="📚"
                    label="My Subjects"
                    value={String(subs.length)}
                    note="Assigned subjects"
                    color="bg-purple-50"
                    iconColor="bg-purple-100"
                  />

                  <StatCard
                    icon="📝"
                    label="My Results"
                    value={String(marks.length)}
                    note="Recorded assessments"
                    color="bg-orange-50"
                    iconColor="bg-orange-100"
                  />

                  <StatCard
                    icon="⭐"
                    label="Average Score"
                    value={averageScore === null ? '—' : `${averageScore}%`}
                    note="Across recorded assessments"
                    color="bg-emerald-50"
                    iconColor="bg-emerald-100"
                  />
                </div>
              </section>

              {/* Subjects */}
              <section className="rounded-3xl border border-indigo-50 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-indigo-950">
                      My subjects 📖
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      The subjects you're learning
                    </p>
                  </div>
                </div>

                {subs.length === 0 ? (
                  <EmptyState
                    icon="🌱"
                    title="Your learning journey starts here"
                    description="Your teacher hasn't assigned any subjects yet."
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {subs.map((subject, index) => {
                      const colors = [
                        'bg-sky-50 border-sky-100',
                        'bg-purple-50 border-purple-100',
                        'bg-amber-50 border-amber-100',
                        'bg-emerald-50 border-emerald-100',
                        'bg-rose-50 border-rose-100',
                        'bg-indigo-50 border-indigo-100',
                      ]

                      return (
                        <div
                          key={`${subject}-${index}`}
                          className={`flex items-center gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 ${colors[index % colors.length]}`}
                        >
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-xl shadow-sm">
                            {['📘', '🧮', '🔬', '🌍', '✍️', '💡'][index % 6]}
                          </div>
                          <div className="min-w-0">
                            <p className="break-words font-bold text-slate-800">
                              {subject}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Keep up the great work!
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Results and announcements */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                <section className="rounded-3xl border border-indigo-50 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold text-indigo-950">
                        Recent results 🏆
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Celebrate your progress
                      </p>
                    </div>
                    <span className="text-2xl">🌟</span>
                  </div>

                  {latestMarks.length === 0 ? (
                    <EmptyState
                      icon="📝"
                      title="Your achievements will appear here"
                      description="Your results will show up when they're recorded."
                    />
                  ) : (
                    <div className="space-y-3">
                      {latestMarks.map((item, index) => {
                        const max = Number(item.assessments.max_marks)
                        const score = Number(item.score)
                        const percentage = max > 0
                          ? Math.round((score / max) * 100)
                          : 0

                        return (
                          <div
                            key={`${item.assessments.title}-${item.assessments.held_on}-${index}`}
                            className="rounded-2xl bg-slate-50 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800">
                                  {item.assessments.title}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {item.assessments.subjects?.name ?? 'Assessment'}
                                  {item.assessments.held_on
                                    ? ` · ${formatDate(item.assessments.held_on)}`
                                    : ''}
                                </p>
                              </div>

                              <span className="shrink-0 rounded-xl bg-emerald-100 px-3 py-2 text-sm font-extrabold text-emerald-700">
                                {score}/{max}
                              </span>
                            </div>

                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                                style={{
                                  width: `${Math.min(100, Math.max(0, percentage))}%`,
                                }}
                              />
                            </div>

                            <div className="mt-2 flex justify-between gap-3 text-xs">
                              <span className="text-slate-500">
                                {item.remarks || 'Keep learning!'}
                              </span>
                              <span className="font-bold text-indigo-700">
                                {percentage}%
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-3xl border border-indigo-50 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold text-indigo-950">
                        What's happening? 📣
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Updates from your teacher
                      </p>
                    </div>
                    <span className="text-2xl">💌</span>
                  </div>

                  {anns.length === 0 ? (
                    <EmptyState
                      icon="🌼"
                      title="It's peaceful here!"
                      description="New announcements from your teacher will appear here."
                    />
                  ) : (
                    <div className="space-y-3">
                      {anns.slice(0, 5).map((announcement, index) => (
                        <article
                          key={announcement.id}
                          className={`rounded-2xl border p-4 ${
                            [
                              'border-sky-100 bg-sky-50',
                              'border-purple-100 bg-purple-50',
                              'border-amber-100 bg-amber-50',
                            ][index % 3]
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xl">
                              {announcement.kind.toLowerCase().includes('urgent')
                                ? '🔔'
                                : announcement.kind.toLowerCase().includes('event')
                                  ? '🎉'
                                  : '💬'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-bold text-slate-800">
                                {announcement.title}
                              </h3>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                                {announcement.body}
                              </p>
                              <p className="mt-2 text-xs text-slate-400">
                                {formatDateTime(announcement.created_at)}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Attendance history */}
              <section className="rounded-3xl border border-indigo-50 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-indigo-950">
                      My attendance 📅
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Your latest attendance records
                    </p>
                  </div>
                  <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700">
                    {attendance}% overall
                  </div>
                </div>

                {att.length === 0 ? (
                  <EmptyState
                    icon="🌤️"
                    title="No attendance recorded yet"
                    description="Your attendance records will appear here."
                  />
                ) : (
                  <div className="space-y-2">
                    {att.slice(0, 7).map((record, index) => {
                      const status = String(record.status).toLowerCase()
                      const present = status === 'present'

                      return (
                        <div
                          key={`${record.attended_on}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white">
                              📅
                            </div>
                            <span className="text-sm font-semibold text-slate-700">
                              {formatDate(record.attended_on)}
                            </span>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                              present
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {record.status}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Footer */}
              <footer className="pb-4 pt-1 text-center">
                <p className="text-sm font-semibold text-indigo-900">
                  Keep shining, {name || 'student'}! 🌈
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Learn a little. Grow a lot. 💜
                </p>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

interface StatCardProps {
  icon: string
  label: string
  value: string
  note: string
  color: string
  iconColor: string
}

function StatCard({
  icon,
  label,
  value,
  note,
  color,
  iconColor,
}: StatCardProps) {
  return (
    <div
      className={`rounded-3xl border border-white p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md sm:p-5 ${color}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-600">
          {label}
        </span>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xl ${iconColor}`}>
          {icon}
        </span>
      </div>

      <p className="mt-4 text-3xl font-extrabold tracking-tight text-indigo-950">
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {note}
      </p>
    </div>
  )
}

interface EmptyStateProps {
  icon: string
  title: string
  description: string
}

function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-indigo-100 bg-indigo-50/40 px-4 py-7 text-center">
      <div className="text-3xl">{icon}</div>
      <p className="mt-3 font-bold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  )
}
