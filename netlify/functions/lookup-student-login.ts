import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const schema = z.object({
  student_code: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/),
})

export const handler: Handler = async (event) => {
  const respond = (statusCode: number, payload: object) => ({
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  })

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' })
  }

  const parsed = schema.safeParse(
    JSON.parse(event.body || '{}'),
  )

  if (!parsed.success) {
    return respond(400, { error: 'Invalid Student ID or password' })
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return respond(500, { error: 'Login service is not configured' })
  }

  const admin = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data, error } = await admin
    .from('student_profiles')
    .select('email,student_code,is_active')
    .ilike('student_code', parsed.data.student_code)
    .limit(2)

  if (error) {
    return respond(500, { error: 'Unable to sign in right now' })
  }

  // Student IDs must identify exactly one active student.
  if (!data || data.length !== 1 || !data[0].is_active) {
    return respond(401, { error: 'Invalid Student ID or password' })
  }

  return respond(200, { login_email: data[0].email })
}
