# PRISM v4

Initial monorepo scaffold for the PRISM insurance review platform.

## Workspace layout

- `server/` API, Prisma schema, and background-job entrypoints
- `ui/` Vue 3 application shell
- `setup/` seed scripts and local bootstrap helpers
- `docs/` project notes and planning artifacts

## Local setup

1. Start local Postgres with `docker compose up -d postgres`.
2. Copy `.env.example` to `.env` and adjust values if your local port or credentials differ.
3. Install dependencies with `npm install`.
4. Generate the Prisma client with `npm run db:generate`.
5. Push the schema with `npm run db:push` or create migrations with `npm run db:migrate`.
6. Seed reference and demo data with `npm run db:seed`.

## Initial build focus

- Single auth system for staff, agency users, and insured users
- Agency-user SSO hooks for Google/Microsoft
- Magic-link customer access
- Supabase Storage for uploaded artifacts
- Resend for email delivery
- OpenRouter-first AI provider integration
- Home and Auto policy structures first, using Nationwide + Virginia starter data
