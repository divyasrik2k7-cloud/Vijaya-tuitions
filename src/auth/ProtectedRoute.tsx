import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth, Role } from './AuthContext'
export default function ProtectedRoute({ role, children }: { role: Exclude<Role, null>; children: ReactNode }) {
  const a = useAuth()
  if (a.loading) return <p className="p-8">Loading…</p>
  if (!a.userId) return <Navigate to="/login" replace />
  if (a.role !== role) return <Navigate to="/" replace />
  return <>{children}</>
}
