import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const body = z.object({
  student_code: z.string().trim().min(1).max(80),
  full_name: z.string().trim().min(2).max(160),
  password: z.string().min(8).max(128),
  guardian_name: z.string().trim().max(160).optional(),
  guardian_phone: z.string().trim().max(40).optional(),
})

export const handler: Handler = async (ev) => {
  const json = (statusCode: number, payload: object) => ({
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(payload),
  })

  if (ev.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, {
      error: 'Student account service is not configured',
    })
  }

  let raw: unknown

  try {
    raw = JSON.parse(ev.body ?? '{}')
  } catch {
    return json(400, { error: 'Request body must be valid JSON' })
  }

  const parsed = body.safeParse(raw)

  if (!parsed.success) {
    return json(400, {
      error: parsed.error.issues[0]?.message ?? 'Invalid request',
    })
  }

  const token = (
    ev.headers.authorization ??
    ev.headers.Authorization ??
    ''
  ).replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return json(401, { error: 'Unauthorized' })
  }

  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )

  const { data: authData, error: authError } =
    await admin.auth.getUser(token)

  if (authError || !authData.user) {
    return json(401, { error: 'Unauthorized' })
  }

  const { data: teacher, error: teacherError } = await admin
    .from('teacher_profiles')
    .select('id')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (teacherError) {
    return json(500, { error: 'Could not verify teacher account' })
  }

  if (!teacher) {
    return json(403, { error: 'Teachers only' })
  }

  const studentCode = parsed.data.student_code.trim()
  const fullName = parsed.data.full_name.trim()

  // Create a predictable, synthetic login email.
  // Including the teacher ID prefix reduces cross-teacher collisions.
  const safeCode = studentCode
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  if (!safeCode) {
    return json(400, {
      error: 'Student ID must contain at least one letter or number',
    })
  }

  const email = `${safeCode}.${teacher.id.slice(0, 8)}@students.vijayatuitions.invalid`

  const { data: existing, error: duplicateError } = await admin
    .from('student_profiles')
    .select('id')
    .eq('teacher_id', teacher.id)
    .eq('student_code', studentCode)
    .maybeSingle()

  if (duplicateError) {
    return json(500, {
      error: 'Could not check for duplicate student IDs',
    })
  }

  if (existing) {
    return json(409, {
      error: 'This Student ID already exists',
    })
  }

  // Supabase Auth emails are globally unique. Check before creating.
  const { data: emailMatches, error: emailCheckError } =
    await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    })

  if (emailCheckError) {
    return json(500, {
      error: 'Could not verify student login availability',
    })
  }

  // Create the account with email already confirmed because the
  // generated address has no mailbox for verification.
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        role: 'student',
        student_code: studentCode,
      },
    })

  if (createError || !created.user) {
    const message = createError?.message ?? ''

    if (/already been registered|already exists/i.test(message)) {
      return json(409, {
        error: 'A login account with this generated email already exists',
      })
    }

    return json(400, {
      error: message || 'Could not create student account',
    })
  }

  const { error: insertError } = await admin
    .from('student_profiles')
    .insert({
      student_code: studentCode,
      full_name: fullName,
      email,
      guardian_name: parsed.data.guardian_name?.trim() || null,
      guardian_phone: parsed.data.guardian_phone?.trim() || null,
      teacher_id: teacher.id,
      auth_user_id: created.user.id,
    })

  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id)

    if (insertError.code === '23505') {
      return json(409, {
        error: 'Student ID or generated login email already exists',
      })
    }

    return json(500, {
      error: 'Student profile could not be saved. Please retry.',
    })
  }

  return json(200, {
    ok: true,
    message: 'Student account created successfully',
    student: {
      student_code: studentCode,
      full_name: fullName,
      login_email: email,
    },
  })
}
