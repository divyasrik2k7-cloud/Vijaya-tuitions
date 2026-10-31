import { useEffect, useState, FormEvent } from 'react'
import { supabase } from '../lib/supabase'

const BOARDS = ['CBSE', 'ICSE', 'AP State Board'] as const
type Board = typeof BOARDS[number]

type ClassRow = {
  id: string
  name: string
  board: Board | null
}

type SubjectRow = {
  id: string
  name: string
}

function ClassesManager() {
  const [rows, setRows] = useState<ClassRow[]>([])
  const [name, setName] = useState('')
  const [board, setBoard] = useState<Board>('CBSE')
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id,name,board')
      .order('name')

    if (error) {
      setMsg('Could not load classes')
      return
    }

    setRows((data ?? []) as ClassRow[])
  }

  useEffect(() => {
    load()
  }, [])

  const report = (error: { code?: string } | null) => {
    setMsg(
      error
        ? error.code === '23505'
          ? 'This class already exists under the selected board.'
          : 'Could not save changes.'
        : ''
    )
  }

  async function add(e: FormEvent) {
    e.preventDefault()

    const n = name.trim()
    if (!n) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMsg('Please log in again.')
      return
    }

    const { error } = await supabase.from('classes').insert({
      name: n,
      board,
      teacher_id: user.id
    })

    report(error)

    if (!error) {
      setName('')
      await load()
    }
  }

  async function rename(r: ClassRow) {
    const n = prompt('Rename class', r.name)?.trim()
    if (!n || n === r.name) return

    const { error } = await supabase
      .from('classes')
      .update({ name: n })
      .eq('id', r.id)

    report(error)
    await load()
  }

  async function changeBoard(r: ClassRow, nextBoard: string) {
    if (!BOARDS.includes(nextBoard as Board)) return

    const { error } = await supabase
      .from('classes')
      .update({ board: nextBoard })
      .eq('id', r.id)

    report(error)

    if (!error) await load()
  }

  return (
    <section className="bg-white rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold">Classes</h2>

      <form onSubmit={add} className="space-y-2">
        <select
          value={board}
          onChange={e => setBoard(e.target.value as Board)}
          aria-label="Select board"
          className="border rounded p-2 w-full"
        >
          {BOARDS.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="New class (e.g. Class 1)"
            aria-label="New class name"
            className="border rounded p-2 flex-1 min-w-0"
          />
          <button className="bg-navy text-white rounded px-3">
            Add
          </button>
        </div>
      </form>

      {msg && <p role="alert" className="text-sm">{msg}</p>}

      {rows.length === 0 ? (
        <p className="text-slate-500">No classes yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(r => (
            <li
              key={r.id}
              className="border-b py-2 space-y-2"
            >
              <div className="flex justify-between items-center gap-2">
                <span className="font-medium">{r.name}</span>
                <button
                  className="underline text-sm"
                  onClick={() => rename(r)}
                >
                  Rename
                </button>
              </div>

              <select
                value={r.board ?? ''}
                onChange={e => changeBoard(r, e.target.value)}
                aria-label={`Board for ${r.name}`}
                className="border rounded p-2 text-sm w-full"
              >
                <option value="">Assign a board</option>
                {BOARDS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SubjectsManager() {
  const [rows, setRows] = useState<SubjectRow[]>([])
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('id,name')
      .order('name')

    if (error) {
      setMsg('Could not load subjects')
      return
    }

    setRows(data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function add(e: FormEvent) {
    e.preventDefault()

    const n = name.trim()
    if (!n) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMsg('Please log in again.')
      return
    }

    const { error } = await supabase.from('subjects').insert({
      name: n,
      teacher_id: user.id
    })

    setMsg(
      error
        ? error.code === '23505'
          ? 'That subject already exists.'
          : 'Could not save subject.'
        : ''
    )

    if (!error) {
      setName('')
      await load()
    }
  }

  async function rename(r: SubjectRow) {
    const n = prompt('Rename subject', r.name)?.trim()
    if (!n || n === r.name) return

    const { error } = await supabase
      .from('subjects')
      .update({ name: n })
      .eq('id', r.id)

    setMsg(
      error
        ? error.code === '23505'
          ? 'That subject already exists.'
          : 'Could not rename subject.'
        : ''
    )

    await load()
  }

  return (
    <section className="bg-white rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold">Subjects</h2>

      <form onSubmit={add} className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="New subject"
          aria-label="New subject"
          className="border rounded p-2 flex-1 min-w-0"
        />
        <button className="bg-navy text-white rounded px-3">
          Add
        </button>
      </form>

      {msg && <p role="alert" className="text-sm">{msg}</p>}

      {rows.length === 0 ? (
        <p className="text-slate-500">No subjects yet.</p>
      ) : (
        <ul>
          {rows.map(r => (
            <li
              key={r.id}
              className="flex justify-between border-b py-2"
            >
              {r.name}
              <button
                className="underline text-sm"
                onClick={() => rename(r)}
              >
                Rename
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function ClassesSubjects() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Classes &amp; subjects</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <ClassesManager />
        <SubjectsManager />
      </div>
    </div>
  )
}
