# Journl

Journl is a web-first journaling app that turns daily writing into structured
reflection. It’s built around a simple principle: journaling is most useful
when it’s easy to revisit, easy to continue, and able to surface patterns over
time. The primary product lives in `apps/web`, and most contributors will work
there.

<img width="1424" height="548" alt="image" src="https://github.com/user-attachments/assets/5a990ee4-9db5-4405-a3ec-4a157600cdb6" />

## Product Overview

Journl helps people capture daily entries and use guidance to deepen their
reflection. The core experience is centered on:

- **Date-based entries** so returning to past writing is predictable.
- **Guided prompts and contextual assistance** so users aren’t left staring at
  a blank page.
- **An embedded assistant surface** that stays alongside the editor rather than
  pulling users into a separate workflow.

## Design Principles

- **The editor is the product**: navigation, account flows, and assistance stay
  out of the way of writing.
- **Guidance over automation**: AI is used to prompt and clarify, not to
  replace the writer.
- **Predictable organization**: date-first navigation keeps the mental model
  simple.
- **UI clarity**: assistant and editor coexist without crowding each other.

## Where to Start

- `apps/web/src/app/(marketing)`: public-facing overview and positioning.
- `apps/web/src/app/(app)`: authenticated journaling experience.
- `apps/web/src/app/(app)/journal`: date-based entry views and editor.
- `apps/web/src/app/(app)/@chatDrawer` and `apps/web/src/app/(app)/@chatSidebar`:
  assistant surfaces embedded in the journaling UI.

## Repository Layout (High Level)

This is a pnpm/Turbo monorepo:

- `apps/web`: Next.js UI runtime and marketing pages.
- `packages/*`: shared TypeScript packages for API, auth, and data access.
- `apps/*` (others): locasl dev utilities and integrations.

## Setup & Run

1) Install toolchain dependencies:
   - **Node.js**: use a version that satisfies the `engines` field in
     `package.json`.
   - **pnpm**: use the repo’s configured version (`packageManager` in
     `package.json`).

2) Install workspace dependencies from the repo root:

    ```bash
    pnpm install
    ```

3) Configure environment variables:

   - Create a `.env` at the repo root.
   - Populate variables needed for database, auth, and Stripe integrations.
     (Turbo scripts reference `dotenv -e ../../.env`.)

4) Run the app:

   - `pnpm dev` starts all tasks via Turbo.
   - `pnpm dev:next` runs only the Next.js app (`apps/web`).

5) (Optional) Database tooling:

   - `pnpm db:push` applies Drizzle migrations.
   - `pnpm db:studio` opens Drizzle Studio.

## Common Scripts

- `pnpm build`: build all apps/packages.
- `pnpm check`: run Biome checks with write/unsafe.
- `pnpm typecheck`: run TypeScript type checks.

See `AGENTS.md` for contributor standards and the full command list.
