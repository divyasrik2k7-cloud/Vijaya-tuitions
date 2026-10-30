# Netlify deployment

## Before deployment

1. Install dependencies and confirm `npm test` and `npm run build` pass.
2. Create a dedicated Supabase project and apply migrations 0001–0005 in the order in `SETUP_GUIDE.md`.
3. Verify teacher/student data isolation with separate test accounts.
4. Confirm file uploads, signed links, invitation emails, password reset, MCQ submission, and result release work in the test project.

## Netlify configuration

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions` (configured in `netlify.toml`)

Configure environment variables in the Netlify site settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL` (the exact deployed origin, e.g. `https://your-site.netlify.app`)

The service-role key is highly privileged. Keep it server-side, never expose it to browser code, never commit it, and rotate it immediately if exposed.

## Supabase Auth URLs

Set the production site URL and add the production login/reset redirect URLs to the Auth redirect allow-list. Add local URLs only if needed for local development.

## After deployment

Use a test teacher and at least two test students. Verify each student cannot read another student's profile, attendance, submissions, marks, announcements, test attempts, or unreleased results. Verify a student cannot read answer keys or change grades/feedback. Test uploads and signed links with unauthorized users. Do not migrate real student data until all checks pass.
