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

Database schema changes live in [`packages/db/src`](./packages/db/src) and are
applied through `pnpm db:push`, which runs Drizzle Kit's schema comparison and
update flow.

Page and journal content saves require the version loaded by the editor. The
version check and write run in one transaction, including the first journal
entry for a date. Versions advance monotonically; retries keep the original
version so a lost response cannot apply a batch twice. Both editors retain local
drafts and pending saves across app navigation and journal row unmounts, warn
before leaving with unsaved changes, and offer retry, draft download, and explicit
conflict recovery. Page titles share the content save queue. A small header icon shows autosave status. A persistent notice identifies offline edits and save failures and offers
recovery at any scroll position and across navigation. Saving resumes on
reconnection; confirmed conflicts always require explicit recovery. Draft recovery keeps exact rich copies before
loading a newer saved version, with read-only viewing/copying and complete JSON
backup downloads. These copies live in the current tab, not durable browser
storage; importing backup files is not yet supported.

Run `pnpm test:browser` to exercise the running Next.js application with
Playwright, including real journal/page editors and save recovery.

Library items use linked sibling ordering. Folder deletion records background
cleanup requests in the Drizzle-defined `folder_deletion_outbox` table within
the deletion transaction. The existing Vercel Workflow handles cleanup; initial
Library reads and the scheduled recovery workflow retry interrupted dispatches.

Tests are colocated with their source modules as `.spec.ts` or `.spec.tsx`;
database suites use `.integration.spec.ts`.

- `pnpm test`: run all unit, UI, database integration, and browser tests.
- `pnpm test:unit`: run unit and UI tests without Docker.
- `pnpm test:integration`: run database integration tests only.

The full suite and integration shortcut require a running Docker-compatible
container runtime, such as Docker Desktop or Colima. They fail if it is unavailable
rather than skipping database tests. Vitest global setup uses Testcontainers to
start PostgreSQL 17 on a random port, passes its connection to the shared fixture
through Vitest's provided context, and stops the container after the run. No
database URL or application environment file is needed locally or in CI.

Each suite uses `src/testing/postgres.ts` to create a unique disposable database,
build its tables from the actual Drizzle definitions, and drop it afterward,
including when setup fails. Select the tables and foreign-key dependencies needed
by the suite; keep queries and transactions real, and mock external providers and
queue dispatch. The unit configuration excludes integration suites. CI runs both
shortcuts in separate jobs, using the same commands as local development without
a separately configured database service. Integration tasks are never cached.

Browser acceptance uses Playwright Test with desktop Chromium and mobile WebKit.
Install browsers once with `pnpm --filter @acme/web exec playwright install --with-deps chromium webkit`,
then run `pnpm test:browser`. It requires Docker, provisions its own disposable
PostgreSQL database from Drizzle definitions, seeds fixture accounts, and signs in
through Better Auth's normal API. It never reads the root `.env` or uses an
application database URL. The runner owns the local server on port 3100 and
refuses to reuse an existing server. Reports and failure traces are ignored artifacts.

`pnpm test` includes browser acceptance as well as unit and database tests; install
its browser dependencies before running it. Unit tests remain Docker-free.

Recurring Explore refresh and folder cleanup recovery jobs remain required
runtime functionality.

---

## License

This project is licensed under the MIT License. See [`LICENSE`](./LICENSE).
