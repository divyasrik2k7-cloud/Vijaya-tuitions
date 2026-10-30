import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { supabase } from '../lib/supabase'

const schema = z.object({
  student_code: z.string().trim().min(1, 'Student ID is required'),
  full_name: z.string().trim().min(2, 'Name must contain at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  guardian_name: z.string().optional(),
  guardian_phone: z.string().optional(),
})

interface S {
  class_id: string | null
  id: string
  student_code: string
  full_name: string
  email: string
  is_active: boolean
}

interface CreatedStudent {
  student_code: string
  full_name: string
  login_email: string
}

export default function Students() {
  const [rows, setRows] = useState<S[]>([])
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [cf, setCf] = useState('')
  const [createdStudent, setCreatedStudent] = useState<CreatedStudent | null>(null)

  const load = async () => {
    const { data, error } = await supabase
      .from('student_profiles')
      .select('id,student_code,full_name,email,is_active,class_id')
      .order('full_name')

    if (error) {
      setMsg('Could not load students. Please refresh the page.')
      return
    }

    setRows(data ?? [])
  }

  useEffect(() => {
    void load()

    supabase
      .from('classes')
      .select('id,name')
      .order('name')
      .then(r => setClasses(r.data ?? []))
  }, [])

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return

    const f = e.currentTarget
    const parsed = schema.safeParse(Object.fromEntries(new FormData(f)))

    if (!parsed.success) {
      setMsg(parsed.error.issues[0]?.message ?? 'Please check the form')
      return
    }

    setBusy(true)
    setMsg('')
    setCreatedStudent(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setMsg('Please log in as a teacher first.')
        return
      }

      const r = await fetch('/.netlify/functions/provision-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(parsed.data),
      })

      const j = await r.json().catch(() => ({}))

      if (!r.ok) {
        setMsg(j.error ?? 'Could not create student account.')
        return
      }

      setCreatedStudent(j.student ?? null)
      setMsg('Student account created successfully! Share the login details securely.')
      f.reset()
      await load()
    } catch {
      setMsg('Could not connect to the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(s: S) {
    if (!confirm(`${s.is_active ? 'Deactivate' : 'Reactivate'} ${s.full_name}? History is kept.`)) return

    const { error } = await supabase
      .from('student_profiles')
      .update({ is_active: !s.is_active })
      .eq('id', s.id)

    if (error) {
      setMsg('Could not update student status.')
      return
    }

    await load()
  }

  const shown = rows.filter(s =>
    (s.full_name + s.student_code).toLowerCase().includes(q.toLowerCase()) &&
    (!cf || s.class_id === cf)
  )

  const q2 = (v: string) => '"' + v.replace(/"/g, '""') + '"'

  async function copyLoginEmail() {
    if (!createdStudent?.login_email) return

    try {
      await navigator.clipboard.writeText(createdStudent.login_email)
      setMsg('Login email copied!')
    } catch {
      setMsg(`Login email: ${createdStudent.login_email}`)
    }
  }

  function exportCsv() {
    const lines = [
      ['student_id', 'name', 'login_email', 'class', 'status'].map(q2).join(','),
      ...shown.map(s => [
        s.student_code,
        s.full_name,
        s.email,
        classes.find(c => c.id === s.class_id)?.name ?? '',
        s.is_active ? 'active' : 'inactive',
      ].map(q2).join(',')),
    ]

    const url = URL.createObjectURL(
      new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    )

    const a = document.createElement('a')
    a.href = url
    a.download = 'students.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Students</h1>

      <form
        onSubmit={add}
        className="bg-white rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <input
          name="student_code"
          placeholder="Student ID"
          aria-label="Student ID"
          className="border rounded p-2"
          required
          maxLength={80}
        />

        <input
          name="full_name"
          placeholder="Full name"
          aria-label="Full name"
          className="border rounded p-2"
          required
          minLength={2}
          maxLength={160}
        />

        <input
          name="password"
          type="password"
          placeholder="Initial password (8–128 characters)"
          aria-label="Initial password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          className="border rounded p-2 sm:col-span-2"
          required
        />

        <input
          name="guardian_name"
          placeholder="Guardian name (optional)"
          aria-label="Guardian name"
          className="border rounded p-2"
          maxLength={160}
        />

        <input
          name="guardian_phone"
          placeholder="Guardian phone (optional)"
          aria-label="Guardian phone"
          className="border rounded p-2"
          maxLength={40}
        />

        <p className="text-sm text-gray-500 sm:col-span-2">
          A login email will be generated automatically from the Student ID.
          No personal email address is required.
        </p>

        <button
          type="submit"
          disabled={busy}
          className="bg-navy text-white rounded p-2 sm:col-span-2 disabled:opacity-50"
        >
          {busy ? 'Creating account…' : 'Create student account'}
        </button>

        {msg && (
          <p role="status" className="sm:col-span-2 text-sm">
            {msg}
          </p>
        )}

        {createdStudent && (
          <div className="sm:col-span-2 rounded-xl border border-green-300 bg-green-50 p-4 space-y-2">
            <h2 className="font-semibold text-green-900">
              Student account created
            </h2>

            <p className="text-sm">
              <strong>Student:</strong> {createdStudent.full_name}
            </p>

            <p className="text-sm">
              <strong>Student ID:</strong> {createdStudent.student_code}
            </p>

            <p className="text-sm break-all">
              <strong>Login email:</strong> {createdStudent.login_email}
            </p>

            <button
              type="button"
              onClick={copyLoginEmail}
              className="rounded bg-green-700 text-white px-3 py-2 text-sm"
            >
              Copy login email
            </button>

            <p className="text-xs text-gray-600">
              Give the student their initial password separately and securely.
              The password is not displayed or stored in this page.
            </p>
          </div>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search name or ID"
          className="border rounded p-2 flex-1"
          aria-label="Search"
        />

        <select
          value={cf}
          onChange={e => setCf(e.target.value)}
          className="border rounded p-2"
          aria-label="Class filter"
        >
          <option value="">All classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button type="button" onClick={exportCsv} className="underline">
          Export CSV
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="text-slate-500">
          No students found. Add your first student above.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-2xl">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Student ID</th>
                <th className="p-2">Name</th>
                <th className="p-2">Login email</th>
                <th className="p-2">Status</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>

            <tbody>
              {shown.map(s => (
                <tr key={s.id} className="border-b">
                  <td className="p-2">{s.student_code}</td>
                  <td className="p-2">
                    <Link className="underline" to={`/teacher/students/${s.id}`}>
                      {s.full_name}
                    </Link>
                  </td>
                  <td className="p-2 break-all">{s.email}</td>
                  <td className="p-2">{s.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="p-2">
                    <button
                      className="underline"
                      onClick={() => toggle(s)}
                    >
                      {s.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
