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
    <main className="login-screen">
      <section className="login-aside" aria-label="Vijaya Tuitions introduction">
        <div className="login-brand"><span className="login-brand-mark">V</span><span>VIJAYA <b>TUITIONS</b></span></div>
        <div className="login-aside-copy">
          <span className="login-kicker">A BETTER WAY TO LEARN</span>
          <h2>Small steps.<br />Big possibilities.</h2>
          <p>A calm, organised space for students to learn and teachers to guide every step forward.</p>
          <div className="login-feature-list"><span>✓ One place for lessons and materials</span><span>✓ Clear homework and test updates</span><span>✓ Progress you can feel good about</span></div>
        </div>
        <div className="login-aside-footer">Learn with purpose. Grow with confidence.</div>
      </section>
      <section className="login-main">
        <form onSubmit={submit} className="login-card">
          <div className="login-card-icon">✦</div>
          <p className="login-kicker login-kicker-dark">WELCOME BACK</p>
          <h1>Sign in to continue</h1>
          <p className="login-description">Access your learning space or teacher workspace.</p>

        <div>
          <label htmlFor="studentCode" className="block text-sm font-medium mb-1">
            Student ID or teacher email
          </label>

          <input
            id="studentCode"
            className="login-input"
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
              className="login-input login-password-input"
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
              className="login-show-password"
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
          className="login-submit"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="login-help">Forgot your password? Please contact your teacher.</p>
        <p className="login-footnote">Your learning journey, all in one place.</p>
        </form>
      </section>
    </main>
  )
}