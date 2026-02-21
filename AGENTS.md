# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm/Turbo monorepo.

- Workspace/package layout: `pnpm-workspace.yaml`
- Shared task graph + env wiring: `turbo.json`
- `apps/web`: Next.js app (marketing + authenticated journal UI + API routes)
- `apps/stripe`, `apps/drizzle-studio`: local dev utilities/integrations
- `packages/auth`, `packages/db`, `packages/blocknote`: shared TypeScript packages
- `tooling/*`: shared configs (for example tsconfig presets)

## Build, Test, and Development Commands

Run commands from the repo root with pnpm.

- `pnpm dev`: start all dev tasks via Turbo.
- `pnpm build`: build all packages/apps.
- `pnpm check`: run Biome checks (with write/unsafe) across the repo.
- `pnpm typecheck`: run TypeScript type checks across the repo.
- `pnpm db:push`: apply Drizzle migrations (uses `.env`).
- `pnpm db:studio`: open Drizzle Studio (uses `.env`).

App-specific scripts live in each package `package.json` (for example `apps/web/package.json`).

## Coding Style & Naming Conventions

- Indentation: 2 spaces, double quotes (enforced by Biome).
- Lint/format: Biome (`biome.json`), run `pnpm check` before PRs.
- TypeScript is the default language across apps/packages.
- Package naming uses the `@acme/*` workspace scope.

## Testing Guidelines

There is no single workspace-wide test command today.

- Treat `pnpm typecheck` and `pnpm check` as required quality gates.
- When adding tests, add a package-local `test` script and document how to run it.

## Commit & Pull Request Guidelines

Git history uses Conventional Commit-style prefixes (`feat`, `fix`, `chore(deps)`), sometimes with scopes (e.g., `feat(journl-agent)`), and PR numbers (e.g., `(#154)`). Follow this pattern.

- Keep commits small and focused.
- PRs should include a clear description, linked issues, and screenshots for UI changes.
- Mention any new environment variables or config steps.

## Configuration Tips

Most scripts load environment variables from a root `.env`.

- Ensure local `.env` values exist for database, auth, AI, and Stripe settings used by `turbo.json`.
- If Drizzle Studio has connectivity issues with pooled/serverless URLs, use `apps/drizzle-studio` scripts for local Studio runs.
