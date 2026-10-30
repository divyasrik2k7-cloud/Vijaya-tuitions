import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type Role = 'teacher' | 'student' | null

interface Ctx {
  userId: string | null
  role: Role
  loading: boolean
}

const C = createContext<Ctx>({
  userId: null,
  role: null,
  loading: true,
})

export const useAuth = () => useContext(C)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Ctx>({
    userId: null,
    role: null,
    loading: true,
  })

  useEffect(() => {
    let active = true
    let requestId = 0
    let authEventVersion = 0

    async function loadRole(userId: string | null) {
      const request = ++requestId

      if (!userId) {
        if (active) {
          setState({ userId: null, role: null, loading: false })
        }
        return
      }

      setState({ userId, role: null, loading: true })

      try {
        const { data: teacher, error: teacherError } = await supabase
          .from('teacher_profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle()

        if (!active || request !== requestId) return

        if (teacherError) {
          console.error('Teacher role lookup failed:', teacherError.message)
        }

        if (teacher) {
          setState({ userId, role: 'teacher', loading: false })
          return
        }

        const { data: student, error: studentError } = await supabase
          .from('student_profiles')
          .select('id')
          .eq('auth_user_id', userId)
          .maybeSingle()

        if (!active || request !== requestId) return

        if (studentError) {
          console.error('Student role lookup failed:', studentError.message)
        }

        setState({
          userId,
          role: student ? 'student' : null,
          loading: false,
        })
      } catch (error) {
        if (!active || request !== requestId) return

        console.error('Authentication initialization failed:', error)

        setState({ userId, role: null, loading: false })
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      authEventVersion += 1
      const userId = session?.user.id ?? null

      // Defer profile queries until the auth callback has completed.
      queueMicrotask(() => {
        if (active) void loadRole(userId)
      })
    })

    const versionBeforeSessionCheck = authEventVersion

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return

        if (error) {
          console.error(
            'Could not restore authentication session:',
            error.message,
          )
        }

        // An auth event is newer than this session check; don't overwrite it.
        if (authEventVersion !== versionBeforeSessionCheck) return

        void loadRole(data.session?.user.id ?? null)
      })
      .catch((error) => {
        if (!active || authEventVersion !== versionBeforeSessionCheck) return

        console.error('Could not restore authentication session:', error)
        setState({ userId: null, role: null, loading: false })
      })

    return () => {
      active = false
      requestId += 1
      subscription.unsubscribe()
    }
  }, [])

  return <C.Provider value={state}>{children}</C.Provider>
}
