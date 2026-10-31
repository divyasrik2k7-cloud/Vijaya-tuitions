import './index.css'
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  NavLink,
  useNavigate,
  useLocation,
} from 'react-router-dom'

import { AuthProvider, useAuth } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ClassesSubjects from './pages/ClassesSubjects'
import StudentProfile from './pages/StudentProfile'
import AttendanceReport from './pages/AttendanceReport'
import Marks from './pages/Marks'
import ProgressReport from './pages/ProgressReport'
import Materials from './pages/Materials'
import Assignments from './pages/Assignments'
import StudentMaterials from './pages/StudentMaterials'
import StudentHomework from './pages/StudentHomework'
import Tests from './pages/Tests'
import Announcements from './pages/Announcements'
import ImportStudents from './pages/ImportStudents'
import StudentTests from './pages/StudentTests'
import Students from './pages/Students'
import Attendance from './pages/Attendance'
import StudentHome from './pages/StudentHome'
import StudentResults from './pages/StudentResults'
import StudentAnnouncements from './pages/StudentAnnouncements'
import DailyPlanner from './pages/DailyPlanner'

import { supabase } from './lib/supabase'

type NavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
}

const teacherItems: NavItem[] = [
  { to: '/teacher', label: 'Overview', icon: '🏠', end: true },
  { to: '/teacher/planner', label: 'Daily Planner', icon: '🗓️' },
  { to: '/teacher/students', label: 'Students', icon: '🧑‍🎓' },
  { to: '/teacher/classes', label: 'Classes & Subjects', icon: '📚' },
  { to: '/teacher/attendance', label: 'Attendance', icon: '📅', end: true },
  { to: '/teacher/attendance/report', label: 'Reports', icon: '📊' },
  { to: '/teacher/marks', label: 'Marks & Results', icon: '🏆' },
  { to: '/teacher/tests', label: 'Online Tests', icon: '📝' },
  { to: '/teacher/announcements', label: 'Announcements', icon: '📣' },
  { to: '/teacher/import', label: 'Import Students', icon: '📥' },
  { to: '/teacher/materials', label: 'Study Materials', icon: '📖' },
  { to: '/teacher/assignments', label: 'Homework', icon: '✏️' },
]

const studentItems: NavItem[] = [
  { to: '/student', label: 'Home', icon: '🏠', end: true },
  { to: '/student/materials', label: 'Study Materials', icon: '📚' },
  { to: '/student/homework', label: 'Homework', icon: '✏️' },
  { to: '/student/tests', label: 'Online Tests', icon: '📝' },
  { to: '/student/results', label: 'Results & Feedback', icon: '🏆' },
  { to: '/student/announcements', label: 'Announcements', icon: '📣' },
]

function Home() {
  const { role, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F5F7FF]">
        <p className="font-semibold text-indigo-700">
          Getting your learning space ready… ✨
        </p>
      </div>
    )
  }

  return (
    <Navigate
      to={
        role === 'teacher'
          ? '/teacher'
          : role === 'student'
            ? '/student'
            : '/login'
      }
      replace
    />
  )
}

function Brand() {
  return (
    <Link to="/" className="brand-lockup">
      <span className="brand-mark">V</span>
      <span>
        <strong>Vijaya</strong>
        <small>TUITIONS</small>
      </span>
    </Link>
  )
}

function ProfileMenu({
  role,
  email,
}: {
  role: 'teacher' | 'student'
  email: string
}) {
  const [open, setOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        setShowProfile(false)
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [])

  async function logout() {
    setLogoutError('')

    const { error } = await supabase.auth.signOut()

    if (error) {
      setLogoutError('Could not log out. Please try again.')
      return
    }

    navigate('/login', { replace: true })
  }

  const initials = email
    ? email.split('@')[0].slice(0, 2).toUpperCase()
    : role === 'teacher'
      ? 'VT'
      : 'ST'

  return (
    <div className="profile-menu">
      <button
        type="button"
        className="profile-trigger"
        aria-label="Open profile menu"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span className="profile-avatar">{initials}</span>

        <span className="profile-copy">
          <strong>{role === 'teacher' ? 'Teacher account' : 'Student account'}</strong>
          <small>{role === 'teacher' ? 'Teacher portal' : 'My learning space'}</small>
        </span>

        <span className="profile-chevron">⌄</span>
      </button>

      {open && (
        <div className="profile-dropdown">
          <div className="px-3 py-2">
            <p className="text-xs font-bold text-slate-800">
              Signed in as
            </p>
            <p className="mt-1 break-all text-xs text-slate-500">
              {email || role}
            </p>
          </div>

          <div className="profile-divider" />

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setShowProfile(true)
            }}
          >
            <span>👤</span>
            My Profile
          </button>

          <div className="profile-divider" />

          <button
            type="button"
            className="danger-action"
            onClick={logout}
          >
            <span>↪</span>
            Log out
          </button>

          {logoutError && (
            <p role="alert" className="px-3 py-2 text-xs text-rose-600">
              {logoutError}
            </p>
          )}
        </div>
      )}

      {showProfile && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setShowProfile(false)
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-dialog-title"
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-200 to-purple-200 text-xl font-extrabold text-indigo-800">
                  {initials}
                </div>

                <h2
                  id="profile-dialog-title"
                  className="mt-4 text-xl font-extrabold text-indigo-950"
                >
                  My Profile
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your account information
                </p>
              </div>

              <button
                type="button"
                aria-label="Close profile"
                className="rounded-xl bg-slate-100 px-3 py-2 text-slate-600"
                onClick={() => setShowProfile(false)}
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-indigo-50 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  Account type
                </p>
                <p className="mt-1 font-bold capitalize text-indigo-950">
                  {role}
                </p>
              </div>

              <div className="rounded-2xl bg-sky-50 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  Login email
                </p>
                <p className="mt-1 break-all font-semibold text-slate-800">
                  {email || 'Not available'}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              For changes to your personal details, contact your tuition
              administrator.
            </p>

            <button
              type="button"
              className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700"
              onClick={() => setShowProfile(false)}
            >
              Done
            </button>
          </section>
        </div>
      )}
    </div>
  )
}

function AppShell({
  children,
  role,
}: {
  children: React.ReactNode
  role: 'teacher' | 'student'
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [email, setEmail] = useState('')
  const location = useLocation()
  const items = role === 'teacher' ? teacherItems : studentItems
  const isTeacher = role === 'teacher'

  useEffect(() => {
    let alive = true

    supabase.auth.getUser().then(({ data }) => {
      if (alive) setEmail(data.user?.email ?? '')
    })

    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [role, location.pathname])

  useEffect(() => {
    if (!mobileOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileOpen])

  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        id="primary-navigation"
        className={`sidebar print:hidden ${mobileOpen ? 'sidebar-open' : ''}`}
        aria-label={isTeacher ? 'Teacher navigation' : 'Student navigation'}
      >
        <Brand />

        <div className="sidebar-label">
          {isTeacher ? 'TEACHER WORKSPACE' : 'MY LEARNING SPACE'}
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                'side-link' + (isActive ? ' active' : '')
              }
            >
              <span className="side-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl bg-gradient-to-br from-sky-50 via-purple-50 to-pink-50 p-4">
          <div className="mb-2 text-2xl">
            {isTeacher ? '🌟' : '🌈'}
          </div>

          <p className="font-extrabold text-indigo-950">
            {isTeacher ? 'Making progress' : 'Keep shining!'}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {isTeacher
              ? 'Little steps make a big difference.'
              : 'Learn a little. Grow a lot.'}
          </p>
        </div>

        <div className="sidebar-bottom">
          <div className="teacher-avatar">
            {email ? email.slice(0, 2).toUpperCase() : isTeacher ? 'VT' : 'ST'}
          </div>

          <div className="teacher-info">
            <strong>{isTeacher ? 'Teacher portal' : 'Student portal'}</strong>
            <span>{isTeacher ? 'Manage your classes' : 'Your learning journey'}</span>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="mobile-menu-button"
              aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
              aria-controls="primary-navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(value => !value)}
            >
              {mobileOpen ? '×' : '☰'}
            </button>

            <div className="min-w-0">
              <span className="eyebrow">
                VIJAYA TUITIONS / {isTeacher ? 'WORKSPACE' : 'MY LEARNING'}
              </span>

              <div className="topbar-title">
                {isTeacher ? 'Learning management' : 'Your learning space ✨'}
              </div>
            </div>
          </div>

          <div className="topbar-right">
            <ProfileMenu role={role} email={email} />
          </div>
        </header>

        <main className="page-content">{children}</main>

        <footer className="app-footer print:hidden">
          Vijaya Tuitions
          <span>·</span>
          A little progress every day adds up. 💜
        </footer>
      </div>
    </div>
  )
}

function TeacherPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute role="teacher">
      <AppShell role="teacher">{children}</AppShell>
    </ProtectedRoute>
  )
}

function StudentPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute role="student">
      <AppShell role="student">{children}</AppShell>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          <Route path="/teacher" element={<TeacherPage><Dashboard /></TeacherPage>} />
          <Route path="/teacher/planner" element={<TeacherPage><DailyPlanner /></TeacherPage>} />
          <Route path="/teacher/classes" element={<TeacherPage><ClassesSubjects /></TeacherPage>} />
          <Route path="/teacher/students" element={<TeacherPage><Students /></TeacherPage>} />
          <Route path="/teacher/students/:id" element={<TeacherPage><StudentProfile /></TeacherPage>} />
          <Route path="/teacher/students/:id/report" element={<TeacherPage><ProgressReport /></TeacherPage>} />
          <Route path="/teacher/attendance" element={<TeacherPage><Attendance /></TeacherPage>} />
          <Route path="/teacher/attendance/report" element={<TeacherPage><AttendanceReport /></TeacherPage>} />
          <Route path="/teacher/marks" element={<TeacherPage><Marks /></TeacherPage>} />
          <Route path="/teacher/tests" element={<TeacherPage><Tests /></TeacherPage>} />
          <Route path="/teacher/announcements" element={<TeacherPage><Announcements /></TeacherPage>} />
          <Route path="/teacher/import" element={<TeacherPage><ImportStudents /></TeacherPage>} />
          <Route path="/teacher/materials" element={<TeacherPage><Materials /></TeacherPage>} />
          <Route path="/teacher/assignments" element={<TeacherPage><Assignments /></TeacherPage>} />

          <Route path="/student" element={<StudentPage><StudentHome /></StudentPage>} />
          <Route path="/student/materials" element={<StudentPage><StudentMaterials /></StudentPage>} />
          <Route path="/student/homework" element={<StudentPage><StudentHomework /></StudentPage>} />
          <Route path="/student/tests" element={<StudentPage><StudentTests /></StudentPage>} />
          <Route path="/student/results" element={<StudentPage><StudentResults /></StudentPage>} />
          <Route path="/student/announcements" element={<StudentPage><StudentAnnouncements /></StudentPage>} />

          <Route
            path="*"
            element={
              <div className="p-10 text-center">
                <h1 className="text-3xl font-bold">404</h1>
                <Link className="underline" to="/">
                  Go home
                </Link>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
