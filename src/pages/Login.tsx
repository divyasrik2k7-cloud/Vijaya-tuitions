import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [studentCode, setStudentCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const nav = useNavigate()

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (loading) return

    setMsg('')
    setLoading(true)

    try {
      const code = studentCode.trim()

      // Preserve the existing teacher email-login experience.
      if (code.includes('@')) {
        const { error } = await supabase.auth.signInWithPassword({
          email: code,
          password,
        })

        if (error) {
          setMsg('Invalid login credentials.')
          return
        }

        nav('/')
        return
      }

      // Resolve the student's synthetic email on the server.
      const response = await fetch(
        '/.netlify/functions/lookup-student-login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_code: code }),
        },
      )

      const result = await response.json().catch(() => ({}))

      if (!response.ok || !result.login_email) {
        setMsg(result.error ?? 'Invalid Student ID or password.')
        return
      }

      // Supabase still verifies the actual password.
      const { error } = await supabase.auth.signInWithPassword({
        email: result.login_email,
        password,
      })

      if (error) {
        setMsg('Invalid Student ID or password.')
        return
      }

      nav('/')
    } catch {
      setMsg('Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-sky-50 p-4">
      <form
        onSubmit={submit}
        className="bg-white p-8 rounded-2xl shadow w-full max-w-sm space-y-4 text-navy"
      >
        <h1 className="text-2xl font-bold">Vijaya Tuitions</h1>

        <p className="text-sm text-gray-500">
          Students can sign in using their Student ID.
          Teachers can continue using their email.
        </p>

        <div>
          <label htmlFor="studentCode" className="block text-sm font-medium mb-1">
            Student ID or teacher email
          </label>

          <input
            id="studentCode"
            className="border rounded p-2 w-full"
            type="text"
            placeholder="e.g. VT001"
            value={studentCode}
            onChange={e => setStudentCode(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>

          <div className="relative">
            <input
              id="password"
              className="border rounded p-2 pr-16 w-full"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-violet-600"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {msg && (
          <p role="alert" className="text-sm text-red-600">
            {msg}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-navy text-white rounded p-2 w-full disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-xs text-gray-500">
          Forgot your password? Please contact your teacher.
        </p>
      </form>
    </div>
  )
}