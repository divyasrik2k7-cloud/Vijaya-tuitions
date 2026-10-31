
import { useEffect, useState, FormEvent } from 'react'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validateFile, safeName } from '../lib/files'
import { openFile } from '../lib/storage'

const BOARDS = ['CBSE', 'ICSE', 'AP State Board'] as const

const CATEGORIES = [
  'Notes',
  'Important Questions',
  'Formulas & Shortcuts',
  'Worksheets & Assignments',
  'Question Banks',
  'Previous Year Questions',
  'Model Papers / Mock Tests',
  'Revision Materials'
] as const

type Board = typeof BOARDS[number]
type Opt = { id: string; name: string }
type ClassOpt = Opt & { board: Board | null }

const schema = z.object({
  title: z.string().trim().min(1, 'Title required'),
  subject_id: z.string().min(1, 'Choose a subject'),
  class_id: z.string().min(1, 'Choose a class'),
  category: z.enum(CATEGORIES, { message: 'Choose a category' }),
  chapter: z.string().trim().max(160, 'Chapter name is too long')
})

export default function Materials() {
  const [subjects, setSubjects] = useState<Opt[]>([])
  const [classes, setClasses] = useState<ClassOpt[]>([])
  const [list, setList] = useState<any[]>([])
  const [board, setBoard] = useState<Board | ''>('')
  const [classId, setClassId] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const filteredClasses = classes.filter(
    c => board !== '' && c.board === board
  )

  const load = async () => {
    const { data, error } = await supabase
      .from('learning_materials')
      .select(`
        id,
        title,
        description,
        published,
        storage_path,
        file_name,
        category,
        chapter,
        subjects(name),
        classes(name,board)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setMsg('Could not load materials')
      return
    }

    setList(data ?? [])
  }

  useEffect(() => {
    load()

    supabase
      .from('subjects')
      .select('id,name')
      .order('name')
      .then(r => setSubjects(r.data ?? []))

    supabase
      .from('classes')
      .select('id,name,board')
      .order('name')
      .then(r => setClasses((r.data ?? []) as ClassOpt[]))
  }, [])

  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (busy) return

    const form = e.currentTarget
    const fd = new FormData(form)

    const p = schema.safeParse({
      title: fd.get('title'),
      subject_id: fd.get('subject_id'),
      class_id: classId,
      category: fd.get('category'),
      chapter: fd.get('chapter') || ''
    })

    if (!p.success) {
      setMsg(p.error.issues[0].message)
      return
    }

    if (!board) {
      setMsg('Choose a board')
      return
    }

    const selectedClass = classes.find(c => c.id === p.data.class_id)

    if (!selectedClass || selectedClass.board !== board) {
      setMsg('Choose a class belonging to the selected board')
      return
    }

    const file = fd.get('file') as File

    if (!file || !file.name) {
      setMsg('Choose a file')
      return
    }

    const fe = validateFile(file)
    if (fe) {
      setMsg(fe)
      return
    }

    setBusy(true)
    setMsg('')

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setBusy(false)
      setMsg('Please log in again')
      return
    }

    const path = `${user.id}/${crypto.randomUUID()}-${safeName(file.name)}`

    const up = await supabase.storage
      .from('materials')
      .upload(path, file, { contentType: file.type })

    if (up.error) {
      setBusy(false)
      setMsg('Upload failed')
      return
    }

    const { error } = await supabase
      .from('learning_materials')
      .insert({
        title: p.data.title,
        subject_id: p.data.subject_id,
        class_id: p.data.class_id,
        category: p.data.category,
        chapter: p.data.chapter || null,
        description: (fd.get('description') as string) || null,
        teacher_id: user.id,
        storage_path: path,
        file_name: file.name
      })

    if (error) {
      await supabase.storage.from('materials').remove([path])
    }

    setMsg(
      error
        ? 'Could not save material'
        : 'Uploaded successfully! Material is unpublished until you publish it.'
    )

    setBusy(false)

    if (!error) {
      form.reset()
      setBoard('')
      setClassId('')
      await load()
    }
  }

  async function toggle(m: any) {
    const { error } = await supabase
      .from('learning_materials')
      .update({ published: !m.published })
      .eq('id', m.id)

    setMsg(error ? 'Could not update publication status' : '')
    await load()
  }

  async function edit(m: any) {
    const t = prompt('Title', m.title)?.trim()
    if (!t) return

    const d = prompt('Description', m.description ?? '')

    const { error } = await supabase
      .from('learning_materials')
      .update({
        title: t,
        description: d?.trim() || null
      })
      .eq('id', m.id)

    setMsg(error ? 'Could not update material' : '')
    await load()
  }

  const inp = 'border rounded p-2 w-full'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Study materials</h1>

      <form
        onSubmit={upload}
        className="bg-white rounded-2xl p-4 grid md:grid-cols-2 gap-3"
      >
        <input
          name="title"
          placeholder="Material title"
          className={inp}
          aria-label="Title"
          required
        />

        <input
          name="description"
          placeholder="Description (optional)"
          className={inp}
          aria-label="Description"
        />

        <select
          name="board"
          value={board}
          onChange={e => {
            setBoard(e.target.value as Board | '')
            setClassId('')
          }}
          className={inp}
          aria-label="Board"
          required
        >
          <option value="">Select board</option>
          {BOARDS.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select
          name="class_id"
          value={classId}
          onChange={e => setClassId(e.target.value)}
          className={inp}
          aria-label="Class"
          required
          disabled={!board}
        >
          <option value="">
            {board ? 'Select class' : 'Select board first'}
          </option>
          {filteredClasses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          name="subject_id"
          className={inp}
          aria-label="Subject"
          required
        >
          <option value="">Select subject</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          name="category"
          className={inp}
          aria-label="Category"
          required
        >
          <option value="">Select category</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <input
          name="chapter"
          placeholder="Chapter name or number (optional)"
          className={inp}
          aria-label="Chapter"
        />

        <input
          name="file"
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
          className={inp}
          aria-label="File"
          required
        />

        <button
          disabled={busy}
          className="bg-navy text-white rounded p-2 md:col-span-2 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Upload material'}
        </button>
      </form>

      {msg && <p role="status">{msg}</p>}

      <section className="bg-white rounded-2xl p-4">
        <h2 className="font-semibold mb-3">Uploaded materials</h2>

        {list.length === 0 ? (
          <p>No materials yet.</p>
        ) : (
          <ul>
            {list.map(m => (
              <li
                key={m.id}
                className="flex flex-wrap gap-3 border-b py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{m.title}</p>
                  <p className="text-sm text-slate-600">
                    {m.classes?.board ?? 'Board not assigned'} ·{' '}
                    {m.classes?.name} · {m.subjects?.name}
                  </p>
                  <p className="text-sm text-slate-600">
                    {m.category ?? 'Uncategorized'}
                    {m.chapter ? ` · ${m.chapter}` : ''}
                    {' · '}
                    {m.published ? 'Published' : 'Draft'}
                  </p>
                </div>

                <button
                  className="underline"
                  onClick={async () => {
                    if (!(await openFile('materials', m.storage_path))) {
                      setMsg('Could not open file')
                    }
                  }}
                >
                  Open
                </button>

                <button
                  className="underline"
                  onClick={() => edit(m)}
                >
                  Edit
                </button>

                <button
                  className="underline"
                  onClick={() => toggle(m)}
                >
                  {m.published ? 'Unpublish' : 'Publish'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
