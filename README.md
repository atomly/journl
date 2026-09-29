<div align="center">
  <img src="docs/images/website-preview.png" alt="Website Preview" width="720" />
  <h1><a href="https://journl-snowy.vercel.app/">Journl</a></h1>
</div>

<p align="center">
  <a href="https://journl-snowy.vercel.app/">
    <img src="https://img.shields.io/badge/Website-journl-111111?logo=vercel&logoColor=white" alt="https://journl-snowy.vercel.app/" />
  </a>
</p>

<p align="center">
  Open source AI-driven journaling app that turns daily writing into structured reflection.
</p>

---

## Repository Structure

This is a monorepo powered by [Turborepo](https://turborepo.dev/) and
[pnpm](https://pnpm.io/).

- Workspace layout is defined in [`pnpm-workspace.yaml`](./pnpm-workspace.yaml).
- Shared task pipeline and env wiring live in [`turbo.json`](./turbo.json).

---

## What Lives Here

- **Web app:** [`apps/web`](./apps/web), including marketing pages,
  authenticated journaling views, API routes, and editor UI.
- **Shared packages:** [`packages`](./packages) for auth, database access,
  usage domain logic, and BlockNote integration.
- **Local dev utilities:** [`apps/drizzle-studio`](./apps/drizzle-studio) and
  [`apps/stripe`](./apps/stripe).
- **Agents & Contributor guidance:** [`AGENTS.md`](./AGENTS.md).

---

## Architecture Entry Points

Use these paths as the fastest way to understand the product and core systems.

- **App surfaces:** [`apps/web/src/app`](./apps/web/src/app)
- **Journal experience:** `apps/web/src/app/(app)/journal`
- **API routes:** [`apps/web/src/app/api`](./apps/web/src/app/api)
- **Editor integration:** [`apps/web/src/components/editor`](./apps/web/src/components/editor)
- **AI/workflow logic:** [`apps/web/src/ai`](./apps/web/src/ai) and [`apps/web/src/workflows`](./apps/web/src/workflows)
- **Auth and usage guards:** [`apps/web/src/auth`](./apps/web/src/auth) and [`apps/web/src/usage`](./apps/web/src/usage)
- **DB schema and usage domain:** [`packages/db/src/schema.ts`](./packages/db/src/schema.ts) and [`packages/db/src/usage`](./packages/db/src/usage)

---

## Development Workflow

Use the scripts in [`package.json`](./package.json) as the canonical source for
day-to-day commands.

- Install dependencies: `pnpm install`
- Start development tasks: `pnpm dev`
- Run quality gates: `pnpm check` and `pnpm typecheck`
- Build the workspace: `pnpm build`

Environment variables are loaded from a root `.env` file. See
[`turbo.json`](./turbo.json) for shared env names used by tasks.
If your local Postgres instance does not support TLS, set `POSTGRES_SSL_MODE=disable` in `.env` (default `auto` already disables SSL on loopback hosts).

For database workflows, use root scripts (`pnpm db:push`, `pnpm db:studio`) or
the dedicated utility app in [`apps/drizzle-studio`](./apps/drizzle-studio).

### Signing in to previews with an existing account

After deploying this change to production, sign in there with Google or GitHub
and open **Account → Security** (`/account/security`). Set a password within
15 minutes of signing in. Accounts with an existing password must provide their
current password to change it.

Preview deployments (`VERCEL_ENV=preview`) and local development show email/password
login at `/auth/sign-in`, including in the sign-in modal. Use the email on your
existing account and the password you set. Production's sign-in screen continues
to show OAuth only; password signup remains disabled in every environment.

Authentication uses each deployment's `POSTGRES_URL`. To access your actual
production account and live journal data, the preview must use that same database;
changes made in that preview will then affect production data. A separate database
needs a copy of your user and linked credential account to accept the same login,
and will only show the data present in that database. This feature does not change
database connections, copy accounts, or share production session cookies.

### Database keepalive

[`apps/web/vercel.json`](./apps/web/vercel.json) schedules a daily production
request to `/api/cron/database-keepalive` at 06:00 UTC (within that hour on Vercel
Hobby). The route starts a Vercel Workflow that runs `select 1` through the shared
Drizzle client, with up to three retries on query failure. It does not read or
write journal data. Daily activity leaves margin inside Supabase's seven-day
inactivity window; this is a best-effort keepalive, not a guarantee against
[Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

To enable it, set `CRON_SECRET` in the web project's Vercel **Production**
environment to a random value of at least 16 characters (for example, generate
one with `openssl rand -hex 32`), then deploy with `apps/web` as the project root.
Vercel sends the secret as a Bearer authorization header. The route rejects
requests when the secret is missing or incorrect. Local development does not
schedule cron requests automatically.

An accepted request returns HTTP 202 with a `runId`; this confirms the workflow
was queued, not that the database query succeeded. Check the run in Vercel
Workflow observability for completion or query errors. If Supabase has already
paused the project, resume it in the Supabase dashboard first.

---

## License

This project is licensed under the MIT License. See [`LICENSE`](./LICENSE).
