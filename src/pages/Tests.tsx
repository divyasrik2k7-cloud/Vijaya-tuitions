import { useEffect, useState, FormEvent } from 'react'
import { z } from 'zod'
import { supabase } from '../lib/supabase'

type Opt = {
  id: string
  name: string
  board?: string | null
}
type QuestionType = 'mcq' | 'true_false' | 'fill_blank' | 'short_answer'

type Question = {
  id: string
  body: string
  marks: number
  position: number
  question_type: QuestionType
  test_options: { id: string; body: string; position: number }[]
}

type Attempt = {
  id: string
  submitted_at: string | null
  student_profiles?: { full_name: string }[] | { full_name: string } | null
  test_results?: {
    score: number
    max_score: number
    grading_complete?: boolean
  } | { score: number; max_score: number; grading_complete?: boolean }[] | null
}

type Answer = {
  id: string
  attempt_id: string
  question_id: string
  answer_text: string | null
  manual_score: number | null
  manual_feedback: string | null
  test_questions?: {
    body: string
    marks: number
    question_type: QuestionType
  } | null
}

const schema = z.object({
  title: z.string().trim().min(1, 'Title required'),
  subject_id: z.string().min(1, 'Choose a subject'),
  class_id: z.string().min(1, 'Choose a class'),
  duration_minutes: z.coerce.number().int().min(1).max(300),
  available_from: z.string().min(1, 'Start required'),
  available_until: z.string().min(1, 'End required')
})

const questionTypes: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Multiple Choice (MCQ)' },
  { value: 'true_false', label: 'True / False' },
  { value: 'fill_blank', label: 'Fill in the Blank' },
  { value: 'short_answer', label: 'Short Answer' }
]

export default function Tests() {
  const [subjects, setSubjects] = useState<Opt[]>([])
  const [classes, setClasses] = useState<Opt[]>([])
  const [list, setList] = useState<any[]>([])
  const [sel, setSel] = useState<any>(null)
  const [qs, setQs] = useState<Question[]>([])
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [textKeys, setTextKeys] = useState<Record<string, string[]>>({})
  const [atts, setAtts] = useState<Attempt[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [questionType, setQuestionType] = useState<QuestionType>('mcq')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const inp = 'border rounded p-2'

  async function loadList() {
    const { data, error } = await supabase
      .from('online_tests')
     .select('id,title,duration_minutes,available_from,available_until,published,results_released,subjects(name),classes(name,board)')
      .order('created_at', { ascending: false })

    if (error) {
      setMsg('Could not load tests')
      return
    }

    setList(data ?? [])
  }

  useEffect(() => {
    loadList()

    supabase
      .from('subjects')
      .select('id,name')
      .order('name')
      .then(r => setSubjects(r.data ?? []))

    supabase
      .from('classes')
      .select('id,name,board')
      .order('name')
      .then(r => setClasses(r.data ?? []))
  }, [])

  async function open(t: any) {
    setSel(t)
    setMsg('')

    const [q, a] = await Promise.all([
      supabase
        .from('test_questions')
        .select('id,body,marks,position,question_type,test_options(id,body,position)')
        .eq('test_id', t.id)
        .order('position'),

      supabase
        .from('test_attempts')
        .select('id,submitted_at,student_profiles(full_name),test_results(score,max_score,grading_complete)')
        .eq('test_id', t.id)
        .order('started_at', { ascending: false })
    ])

    if (q.error || a.error) {
      setMsg('Could not load test details')
      return
    }

    const questions = (q.data ?? []) as Question[]
    const attempts = (a.data ?? []) as Attempt[]

    setQs(questions)
    setAtts(attempts)

    const ids = questions.map(x => x.id)
    const attemptIds = attempts.map(x => x.id)

    const [k, tk, ans] = await Promise.all([
      ids.length
        ? supabase
            .from('test_answer_keys')
            .select('question_id,option_id')
            .in('question_id', ids)
        : Promise.resolve({ data: [] as any[], error: null }),

      ids.length
        ? supabase
            .from('test_text_answer_keys')
            .select('question_id,accepted_answers')
            .in('question_id', ids)
        : Promise.resolve({ data: [] as any[], error: null }),

      attemptIds.length
        ? supabase
            .from('test_answers')
            .select('id,attempt_id,question_id,answer_text,manual_score,manual_feedback,test_questions(body,marks,question_type)')
            .in('attempt_id', attemptIds)
        : Promise.resolve({ data: [] as any[], error: null })
    ])

    if (k.error || tk.error || ans.error) {
      setMsg('Could not load answer details')
      return
    }

    setKeys(
      Object.fromEntries((k.data ?? []).map((x: any) => [
        x.question_id,
        x.option_id
      ]))
    )

    setTextKeys(
      Object.fromEntries((tk.data ?? []).map((x: any) => [
        x.question_id,
        x.accepted_answers
      ]))
    )

    setAnswers((ans.data ?? []) as Answer[])
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const form = e.currentTarget
    const p = schema.safeParse(Object.fromEntries(new FormData(form)))

    if (!p.success) {
      setMsg(p.error.issues[0].message)
      return
    }

    const from = new Date(p.data.available_from)
    const to = new Date(p.data.available_until)

    if (to <= from) {
      setMsg('End must be after start')
      return
    }

    setBusy(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setMsg('Please sign in again')
      setBusy(false)
      return
    }

    const { error } = await supabase
      .from('online_tests')
      .insert({
        ...p.data,
        available_from: from.toISOString(),
        available_until: to.toISOString(),
        teacher_id: user.id
      })

    setBusy(false)

    if (error) {
      setMsg(error.message)
      return
    }

    form.reset()
    setMsg('Test created successfully (unpublished)')
    loadList()
  }

  async function addQ(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!sel) return

    const form = e.currentTarget
    const fd = new FormData(form)

    const body = String(fd.get('body') ?? '').trim()
    const marks = Number(fd.get('marks') || 1)

    if (!body) return setMsg('Question text required')
    if (!Number.isFinite(marks) || marks <= 0) {
      return setMsg('Marks must be positive')
    }

    const opts =
      questionType === 'true_false'
        ? ['True', 'False']
        : [0, 1, 2, 3].map(i =>
            String(fd.get('o' + i) ?? '').trim()
          )

    const correct = Number(fd.get('correct'))

    if (questionType === 'mcq' && opts.filter(Boolean).length < 2) {
      return setMsg('Give at least two options')
    }

    if (
      questionType === 'mcq' &&
      (!Number.isInteger(correct) || !opts[correct])
    ) {
      return setMsg('Select a correct option that is filled in')
    }

    if (questionType === 'true_false' && ![0, 1].includes(correct)) {
      return setMsg('Select the correct answer')
    }

    const acceptedAnswers = String(fd.get('accepted_answers') ?? '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean)

    if (
      questionType === 'fill_blank' &&
      acceptedAnswers.length === 0
    ) {
      return setMsg('Enter at least one accepted answer')
    }

    setBusy(true)

    const q = await supabase
      .from('test_questions')
      .insert({
        test_id: sel.id,
        position: qs.length + 1,
        body,
        marks,
        question_type: questionType
      })
      .select('id')
      .single()

    if (q.error) {
      setBusy(false)
      setMsg(q.error.message)
      return
    }

    let saveError: any = null

    if (questionType === 'mcq' || questionType === 'true_false') {
      const optionRows = opts
        .map((b, i) => ({ body: b, position: i }))
        .filter(x => x.body)
        .map(x => ({
          question_id: q.data.id,
          position: x.position,
          body: x.body
        }))

      const o = await supabase
        .from('test_options')
        .insert(optionRows)
        .select('id,position')

      if (o.error) {
        saveError = o.error
      } else {
        const correctOption = o.data?.find(
          x => x.position === correct
        )

        if (!correctOption) {
          saveError = new Error('Correct option was not saved')
        } else {
          const k = await supabase
            .from('test_answer_keys')
            .insert({
              question_id: q.data.id,
              option_id: correctOption.id
            })

          if (k.error) saveError = k.error
        }
      }
    }

    if (questionType === 'fill_blank') {
      const tk = await supabase
        .from('test_text_answer_keys')
        .insert({
          question_id: q.data.id,
          accepted_answers: acceptedAnswers
        })

      if (tk.error) saveError = tk.error
    }

    if (saveError) {
      // Remove the incomplete question and its dependent records.
      await supabase
        .from('test_questions')
        .delete()
        .eq('id', q.data.id)

      setBusy(false)
      setMsg('Could not save the complete question: ' + saveError.message)
      return
    }

    form.reset()
    setQuestionType('mcq')
    setBusy(false)
    setMsg('Question added successfully')
    await open(sel)
  }

  async function flag(field: 'published' | 'results_released') {
    if (!sel) return

    if (field === 'published' && !sel.published && qs.length === 0) {
      return setMsg('Add at least one question before publishing')
    }

    setBusy(true)

    const { error } = await supabase
      .from('online_tests')
      .update({ [field]: !sel[field] })
      .eq('id', sel.id)

    setBusy(false)

    if (error) {
      setMsg(error.message)
      return
    }

    const updated = { ...sel, [field]: !sel[field] }
    setSel(updated)
    setMsg(field === 'published'
      ? (updated.published ? 'Test published' : 'Test unpublished')
      : (updated.results_released ? 'Results released' : 'Results hidden')
    )

    loadList()
  }

  async function gradeAnswer(answer: Answer, form: HTMLFormElement) {
    const fd = new FormData(form)
    const score = Number(fd.get('score'))
    const feedback = String(fd.get('feedback') ?? '').trim()

    if (!Number.isFinite(score)) {
      setMsg('Enter a valid score')
      return
    }

    const maxMarks = Number(answer.test_questions?.marks ?? 0)

    if (score < 0 || score > maxMarks) {
      setMsg(`Score must be between 0 and ${maxMarks}`)
      return
    }

    setBusy(true)

    const { error } = await supabase.rpc('grade_test_answer', {
      p_attempt: answer.attempt_id,
      p_question: answer.question_id,
      p_score: score,
      p_feedback: feedback || null
    })

    setBusy(false)

    if (error) {
      setMsg(error.message)
      return
    }

    setMsg('Answer graded successfully')
    await open(sel)
  }

  function getResult(a: Attempt) {
    return Array.isArray(a.test_results)
      ? a.test_results[0]
      : a.test_results
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Online tests</h1>

      <form
        onSubmit={create}
        className="bg-white rounded-2xl p-4 grid md:grid-cols-3 gap-2"
      >
        <input
          name="title"
          placeholder="Test title"
          className={inp}
          aria-label="Title"
          required
        />

        <select
          name="subject_id"
          className={inp}
          aria-label="Subject"
          required
          defaultValue=""
        >
          <option value="">Subject</option>
          {subjects.map(x => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>

        <select
          name="class_id"
          className={inp}
          aria-label="Class"
          required
          defaultValue=""
        >
          <option value="">Class</option>
          {classes.map(x => (
  <option key={x.id} value={x.id}>
    {x.board ?? 'Board not assigned'} · {x.name}
  </option>
))}</select>

        <input
          name="duration_minutes"
          type="number"
          min="1"
          max="300"
          placeholder="Minutes"
          className={inp}
          aria-label="Duration in minutes"
          required
        />

        <input
          name="available_from"
          type="datetime-local"
          className={inp}
          aria-label="Available from"
          required
        />

        <input
          name="available_until"
          type="datetime-local"
          className={inp}
          aria-label="Available until"
          required
        />

        <button
          disabled={busy}
          className="bg-navy text-white rounded p-2 md:col-span-3 disabled:opacity-50"
        >
          {busy ? 'Please wait...' : 'Create test'}
        </button>
      </form>

      {msg && <p role="status">{msg}</p>}

      {list.length === 0 ? (
        <p>No tests yet.</p>
      ) : (
        <ul className="bg-white rounded-2xl p-4">
          {list.map(t => (
            <li
              key={t.id}
              className="flex justify-between gap-3 border-b py-2"
            >
              <span>
               {t.title} · {t.classes?.board ?? 'Board not assigned'}
· {t.classes?.name} · {t.subjects?.name}
{' · '}{t.duration_minutes} min
{' · '}{t.published ? 'Published' : 'Draft'}
              </span>

              <button
                type="button"
                className="underline shrink-0"
                onClick={() => open(t)}
              >
                Manage
              </button>
            </li>
          ))}
        </ul>
      )}

      {sel && (
        <div className="bg-white rounded-2xl p-4 space-y-4">
          <h2 className="font-semibold text-xl">{sel.title}</h2>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              className="underline"
              onClick={() => flag('published')}
            >
              {sel.published ? 'Unpublish' : 'Publish'}
            </button>

            <button
              type="button"
              disabled={busy}
              className="underline"
              onClick={() => flag('results_released')}
            >
              {sel.results_released
                ? 'Hide results from students'
                : 'Release results to students'}
            </button>
          </div>

          <div>
            <h3 className="font-semibold mb-2">
              Questions ({qs.length})
            </h3>

            {qs.length === 0 ? (
              <p>No questions added yet.</p>
            ) : (
              <ol className="list-decimal pl-5 space-y-3">
                {qs.map(q => (
                  <li key={q.id}>
                    <div className="font-medium">
                      {q.body} ({q.marks} marks)
                    </div>

                    <p className="text-sm text-gray-500">
                      {questionTypes.find(x => x.value === q.question_type)?.label}
                    </p>

                    {q.question_type === 'mcq' ||
                    q.question_type === 'true_false' ? (
                      <ul className="pl-4">
                        {[...q.test_options]
                          .sort((a, b) => a.position - b.position)
                          .map(o => (
                            <li key={o.id}>
                              {o.id === keys[q.id] ? '✓ ' : '• '}
                              {o.body}
                            </li>
                          ))}
                      </ul>
                    ) : q.question_type === 'fill_blank' ? (
                      <p className="text-sm text-gray-600">
                        Accepted answers: {(textKeys[q.id] ?? []).join(', ')}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-600">
                        Teacher-evaluated answer
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {!sel.published && (
            <form onSubmit={addQ} className="grid gap-3 border-t pt-4">
              <h3 className="font-semibold">Add a question</h3>

              <select
                className={inp}
                value={questionType}
                onChange={e =>
                  setQuestionType(e.target.value as QuestionType)
                }
                aria-label="Question type"
              >
                {questionTypes.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <textarea
                name="body"
                placeholder="Enter your question"
                className={inp}
                aria-label="Question"
                required
                rows={3}
              />

              <input
                name="marks"
                type="number"
                step="0.5"
                min="0.5"
                defaultValue={1}
                className={inp}
                aria-label="Marks"
                required
              />

              {questionType === 'mcq' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Enter options and select the correct answer.
                  </p>

                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="radio"
                        name="correct"
                        value={i}
                        defaultChecked={i === 0}
                        aria-label={`Option ${i + 1} is correct`}
                      />

                      <input
                        name={'o' + i}
                        placeholder={`Option ${i + 1}`}
                        className={inp + ' flex-1'}
                        aria-label={`Option ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {questionType === 'true_false' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Select the correct answer.
                  </p>

                  <label className="flex gap-2 items-center">
                    <input
                      type="radio"
                      name="correct"
                      value="0"
                      defaultChecked
                    />
                    True
                  </label>

                  <label className="flex gap-2 items-center">
                    <input
                      type="radio"
                      name="correct"
                      value="1"
                    />
                    False
                  </label>
                </div>
              )}

              {questionType === 'fill_blank' && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Accepted answers
                  </label>

                  <input
                    name="accepted_answers"
                    placeholder="Example: photosynthesis, Photo synthesis"
                    className={inp + ' w-full'}
                    aria-label="Accepted answers separated by commas"
                  />

                  <p className="text-xs text-gray-500">
                    Separate alternative correct answers with commas.
                    Matching ignores capitalization and surrounding spaces.
                  </p>
                </div>
              )}

              {questionType === 'short_answer' && (
                <p className="text-sm text-gray-600">
                  Students will enter a written response. You will evaluate
                  it manually after submission.
                </p>
              )}

              <button
                disabled={busy}
                className="bg-navy text-white rounded p-2 disabled:opacity-50"
              >
                {busy ? 'Saving...' : 'Add question'}
              </button>
            </form>
          )}

          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold">
              Student attempts ({atts.length})
            </h3>

            {atts.length === 0 ? (
              <p>No attempts yet.</p>
            ) : (
              <div className="space-y-4">
                {atts.map(a => {
                  const result = getResult(a)
                  const studentAnswers = answers.filter(
                    x => x.attempt_id === a.id
                  )

                  return (
                    <div
                      key={a.id}
                      className="border rounded-xl p-3 space-y-3"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <strong>
                          {Array.isArray(a.student_profiles)
  ? a.student_profiles[0]?.full_name ?? 'Student'
  : a.student_profiles?.full_name ?? 'Student'}
                        </strong>

                        <span className="text-sm">
                          {a.submitted_at
                            ? result
                              ? `${result.score}/${result.max_score}`
                              : 'Submitted'
                            : 'In progress'}
                        </span>
                      </div>

                      {a.submitted_at && result && (
                        <p className="text-sm text-gray-600">
                          {result.grading_complete === false
                            ? 'Manual grading pending'
                            : 'Grading complete'}
                        </p>
                      )}

                      {a.submitted_at &&
                        studentAnswers
                          .filter(x =>
                            x.test_questions?.question_type === 'short_answer'
                          )
                          .map(answer => (
                            <div
                              key={answer.id}
                              className="bg-gray-50 rounded-lg p-3 space-y-2"
                            >
                              <p className="font-medium">
                                {answer.test_questions?.body}
                              </p>

                              <p className="text-sm whitespace-pre-wrap">
                                {answer.answer_text}
                              </p>

                              <form
                                className="grid gap-2"
                                onSubmit={e => {
                                  e.preventDefault()
                                  gradeAnswer(answer, e.currentTarget)
                                }}
                              >
                                <label className="text-sm">
                                  Marks (maximum {answer.test_questions?.marks})
                                </label>

                                <input
                                  name="score"
                                  type="number"
                                  min="0"
                                  max={answer.test_questions?.marks}
                                  step="0.5"
                                  defaultValue={answer.manual_score ?? ''}
                                  placeholder="Enter awarded marks"
                                  className={inp}
                                  required
                                />

                                <textarea
                                  name="feedback"
                                  defaultValue={answer.manual_feedback ?? ''}
                                  placeholder="Feedback for student (optional)"
                                  className={inp}
                                  rows={2}
                                />

                                <button
                                  disabled={busy}
                                  className="bg-navy text-white rounded p-2 disabled:opacity-50"
                                >
                                  Save grade
                                </button>
                              </form>
                            </div>
                          ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
