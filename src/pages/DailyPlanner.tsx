import { useCallback, useEffect, useMemo, useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Option = { id: string; name: string; board?: string | null }
type TestOption = {
  id: string
  title: string
  class_id: string
  subject_id: string
  published: boolean
}
type MaterialOption = {
  id: string
  title: string
  class_id: string
  subject_id: string
  published: boolean
}
type LessonEntry = {
  id: string
  lesson_date: string
  class_id: string
  subject_id: string
  topic: string
  notes: string | null
  homework: string | null
  status: 'planned' | 'completed'
  test_id: string | null
  material_id: string | null
  classes?: { name: string; board: string | null } | { name: string; board: string | null }[] | null
  subjects?: { name: string } | { name: string }[] | null
  online_tests?: { title: string } | { title: string }[] | null
  learning_materials?: { title: string } | { title: string }[] | null
}

type FormState = {
  class_id: string
  subject_id: string
  topic: string
  notes: string
  homework: string
  test_id: string
  material_id: string
  status: 'planned' | 'completed'
}

const emptyForm: FormState = {
  class_id: '',
  subject_id: '',
  topic: '',
  notes: '',
  homework: '',
  test_id: '',
  material_id: '',
  status: 'completed',
}

function localDate(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function prettyDate(value: string) {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default function DailyPlanner() {
  const [selectedDate, setSelectedDate] = useState(localDate())
  const [classes, setClasses] = useState<Option[]>([])
  const [subjects, setSubjects] = useState<Option[]>([])
  const [tests, setTests] = useState<TestOption[]>([])
  const [materials, setMaterials] = useState<MaterialOption[]>([])
  const [records, setRecords] = useState<LessonEntry[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [historyClass, setHistoryClass] = useState('')
  const [historySubject, setHistorySubject] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    const [classResult, subjectResult, testResult, materialResult, recordResult] =
      await Promise.all([
        supabase.from('classes').select('id,name,board').order('name'),
        supabase.from('subjects').select('id,name').order('name'),
        supabase
          .from('online_tests')
          .select('id,title,class_id,subject_id,published')
          .order('created_at', { ascending: false }),
        supabase
          .from('learning_materials')
          .select('id,title,class_id,subject_id,published')
          .order('created_at', { ascending: false }),
        supabase
          .from('daily_lesson_entries')
          .select(
            'id,lesson_date,class_id,subject_id,topic,notes,homework,status,test_id,material_id,classes(name,board),subjects(name),online_tests(title),learning_materials(title)'
          )
          .order('lesson_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(500),
      ])

    const failed = [
      classResult.error,
      subjectResult.error,
      testResult.error,
      materialResult.error,
      recordResult.error,
    ].find(Boolean)

    if (failed) {
      setError(
        failed.message.includes('daily_lesson_entries')
          ? 'The Daily Planner database migration has not been applied yet. Apply migration 0009_daily_planner.sql in Supabase SQL Editor, then refresh this page.'
          : `Could not load planner data: ${failed.message}`
      )
      setLoading(false)
      return
    }

    setClasses((classResult.data ?? []) as Option[])
    setSubjects((subjectResult.data ?? []) as Option[])
    setTests((testResult.data ?? []) as TestOption[])
    setMaterials((materialResult.data ?? []) as MaterialOption[])
    setRecords((recordResult.data ?? []) as LessonEntry[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const selectedDayRecords = useMemo(
    () => records.filter(record => record.lesson_date === selectedDate),
    [records, selectedDate]
  )

  const historyRecords = useMemo(() => {
    const term = historySearch.trim().toLowerCase()
    return records.filter(record => {
      if (record.lesson_date === selectedDate) return false
      if (historyClass && record.class_id !== historyClass) return false
      if (historySubject && record.subject_id !== historySubject) return false
      if (!term) return true
      return [
        record.topic,
        record.notes ?? '',
        record.homework ?? '',
        relationOne(record.classes)?.name ?? '',
        relationOne(record.subjects)?.name ?? '',
      ].some(value => value.toLowerCase().includes(term))
    })
  }, [records, selectedDate, historyClass, historySubject, historySearch])

  const matchingTests = useMemo(
    () =>
      tests.filter(
        test =>
          test.class_id === form.class_id &&
          test.subject_id === form.subject_id
      ),
    [tests, form.class_id, form.subject_id]
  )

  const matchingMaterials = useMemo(
    () =>
      materials.filter(
        material =>
          material.class_id === form.class_id &&
          material.subject_id === form.subject_id
      ),
    [materials, form.class_id, form.subject_id]
  )

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(current => ({
      ...current,
      [key]: value,
      ...(key === 'class_id' || key === 'subject_id'
        ? { test_id: '', material_id: '' }
        : {}),
    }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setMessage('')
    setError('')
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!form.class_id || !form.subject_id || !form.topic.trim()) {
      setError('Choose a class, subject and enter the topic covered.')
      return
    }

    setSaving(true)
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      setSaving(false)
      setError('Your session has expired. Please sign in again.')
      return
    }

    const payload = {
      teacher_id: authData.user.id,
      lesson_date: selectedDate,
      class_id: form.class_id,
      subject_id: form.subject_id,
      topic: form.topic.trim(),
      notes: form.notes.trim() || null,
      homework: form.homework.trim() || null,
      status: form.status,
      test_id: form.test_id || null,
      material_id: form.material_id || null,
    }

    const result = editingId
      ? await supabase
          .from('daily_lesson_entries')
          .update(payload)
          .eq('id', editingId)
      : await supabase.from('daily_lesson_entries').insert(payload)

    setSaving(false)
    if (result.error) {
      setError(`Could not save this record: ${result.error.message}`)
      return
    }

    setMessage(editingId ? 'Daily record updated.' : 'Daily record saved.')
    setForm(emptyForm)
    setEditingId(null)
    await loadData()
  }

  function startEdit(record: LessonEntry) {
    setSelectedDate(record.lesson_date)
    setEditingId(record.id)
    setForm({
      class_id: record.class_id,
      subject_id: record.subject_id,
      topic: record.topic,
      notes: record.notes ?? '',
      homework: record.homework ?? '',
      test_id: record.test_id ?? '',
      material_id: record.material_id ?? '',
      status: record.status,
    })
    setMessage('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteEntry(record: LessonEntry) {
    const confirmed = window.confirm(
      `Delete the ${relationOne(record.subjects)?.name ?? 'subject'} record for ${prettyDate(record.lesson_date)}?`
    )
    if (!confirmed) return

    const { error: deleteError } = await supabase
      .from('daily_lesson_entries')
      .delete()
      .eq('id', record.id)

    if (deleteError) {
      setError(`Could not delete this record: ${deleteError.message}`)
      return
    }
    setMessage('Daily record deleted.')
    if (editingId === record.id) resetForm()
    await loadData()
  }

  function EntryCard({ record }: { record: LessonEntry }) {
    const classInfo = relationOne(record.classes)
    const subjectInfo = relationOne(record.subjects)
    const testInfo = relationOne(record.online_tests)
    const materialInfo = relationOne(record.learning_materials)

    return (
      <article className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-700">
                {classInfo?.board ?? 'Board not assigned'} · {classInfo?.name ?? 'Class'}
              </span>
              <span>{subjectInfo?.name ?? 'Subject'}</span>
              <span
                className={`rounded-full px-2.5 py-1 font-semibold ${
                  record.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {record.status === 'completed' ? 'Completed' : 'Planned'}
              </span>
            </div>
            <h3 className="mt-3 text-base font-extrabold text-slate-900">
              {record.topic}
            </h3>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => startEdit(record)}
              className="rounded-xl border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void deleteEntry(record)}
              className="rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
            >
              Delete
            </button>
          </div>
        </div>

        {record.notes && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Class notes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {record.notes}
            </p>
          </div>
        )}

        {record.homework && (
          <div className="mt-3 rounded-xl bg-amber-50/70 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
              Homework / follow-up
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {record.homework}
            </p>
          </div>
        )}

        {(testInfo?.title || materialInfo?.title) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {testInfo?.title && (
              <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
                📝 Test: {testInfo.title}
              </span>
            )}
            {materialInfo?.title && (
              <span className="rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700">
                📎 Material: {materialInfo.title}
              </span>
            )}
          </div>
        )}
      </article>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
            Teacher workspace
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Daily Academic Planner
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Record the subjects taught, topics covered, class notes, homework and any test or study material for each class day.
          </p>
        </div>
        <Link
          to="/teacher/tests"
          className="inline-flex w-fit items-center rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-50"
        >
          Manage online tests →
        </Link>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <section className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-violet-600">
              Selected teaching day
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900">
              {prettyDate(selectedDate)}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(localDate(new Date(new Date().setDate(new Date().getDate() - 1))))}
              className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(localDate())}
              className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700"
            >
              Today
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={event => {
                setSelectedDate(event.target.value)
                setEditingId(null)
                setForm(emptyForm)
              }}
              className="min-h-10 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-slate-700"
              aria-label="Choose planner date"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)]">
        <form onSubmit={saveEntry} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                {editingId ? 'Edit daily record' : 'Add subject to this day'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Add one record for each class and subject taught.
              </p>
            </div>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-xs font-bold text-violet-700">
                Cancel edit
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold text-slate-600">
              Class
              <select
                value={form.class_id}
                onChange={event => updateForm('class_id', event.target.value)}
                required
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800"
              >
                <option value="">Select class</option>
                {classes.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.board ? `${item.board} · ` : ''}{item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-slate-600">
              Subject
              <select
                value={form.subject_id}
                onChange={event => updateForm('subject_id', event.target.value)}
                required
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800"
              >
                <option value="">Select subject</option>
                {subjects.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-slate-600 sm:col-span-2">
              Topic / chapter covered
              <input
                value={form.topic}
                onChange={event => updateForm('topic', event.target.value)}
                required
                maxLength={180}
                placeholder="e.g. Quadratic equations — introduction"
                className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-800"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-slate-600 sm:col-span-2">
              Class notes / key points
              <textarea
                value={form.notes}
                onChange={event => updateForm('notes', event.target.value)}
                rows={4}
                placeholder="What was explained? Important definitions, examples or points to remember..."
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-800"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-slate-600 sm:col-span-2">
              Homework / follow-up
              <textarea
                value={form.homework}
                onChange={event => updateForm('homework', event.target.value)}
                rows={2}
                placeholder="Practice questions, pages to complete or what to revise..."
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-800"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-slate-600">
              Test (optional)
              <select
                value={form.test_id}
                onChange={event => updateForm('test_id', event.target.value)}
                disabled={!form.class_id || !form.subject_id}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 disabled:bg-slate-50"
              >
                <option value="">No test linked</option>
                {matchingTests.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.title}{item.published ? ' · Published' : ' · Draft'}
                  </option>
                ))}
              </select>
              {form.class_id && form.subject_id && matchingTests.length === 0 && (
                <span className="font-normal text-slate-400">No tests exist for this class and subject yet.</span>
              )}
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-slate-600">
              Study material (optional)
              <select
                value={form.material_id}
                onChange={event => updateForm('material_id', event.target.value)}
                disabled={!form.class_id || !form.subject_id}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 disabled:bg-slate-50"
              >
                <option value="">No material linked</option>
                {matchingMaterials.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.title}{item.published ? ' · Published' : ' · Draft'}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-slate-600 sm:col-span-2">
              Record status
              <select
                value={form.status}
                onChange={event => updateForm('status', event.target.value as FormState['status'])}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800"
              >
                <option value="completed">Completed — class was taught</option>
                <option value="planned">Planned — not taught yet</option>
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || loading}
              className="min-h-11 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : editingId ? 'Update record' : 'Save daily record'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="min-h-11 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Clear form
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">This day's records</h2>
              <p className="mt-1 text-xs text-slate-500">{selectedDayRecords.length} subject record(s)</p>
            </div>
            <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
              {selectedDayRecords.filter(item => item.status === 'completed').length} completed
            </span>
          </div>
          {loading ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading daily records…</p>
          ) : selectedDayRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-6 text-center">
              <div className="text-3xl">🗓️</div>
              <p className="mt-3 text-sm font-bold text-slate-700">Nothing recorded for this date</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Add each subject taught or planned using the form.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayRecords.map(record => <EntryCard key={record.id} record={record} />)}
            </div>
          )}
        </section>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Previous daily records</h2>
            <p className="mt-1 text-xs text-slate-500">
              Browse and edit earlier teaching records. The latest 500 records are loaded.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={historySearch}
              onChange={event => setHistorySearch(event.target.value)}
              placeholder="Search topic or notes"
              aria-label="Search history"
              className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
            <select
              value={historyClass}
              onChange={event => setHistoryClass(event.target.value)}
              aria-label="Filter history by class"
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">All classes</option>
              {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select
              value={historySubject}
              onChange={event => setHistorySubject(event.target.value)}
              aria-label="Filter history by subject"
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">All subjects</option>
              {subjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading history…</p>
        ) : historyRecords.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center">
            <p className="text-sm font-bold text-slate-700">No previous records found</p>
            <p className="mt-1 text-xs text-slate-500">Records from other dates will appear here.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {Object.entries(
              historyRecords.reduce<Record<string, LessonEntry[]>>((groups, record) => {
                ;(groups[record.lesson_date] ??= []).push(record)
                return groups
              }, {})
            ).map(([date, entries]) => (
              <div key={date}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-extrabold text-slate-800">{prettyDate(date)}</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className="text-xs font-bold text-violet-700 hover:underline"
                  >
                    View this day
                  </button>
                </div>
                <div className="grid gap-3 xl:grid-cols-2">
                  {entries.map(record => <EntryCard key={record.id} record={record} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
