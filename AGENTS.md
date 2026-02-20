# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm/Turbo monorepo. Top-level workspace configuration lives in `pnpm-workspace.yaml` and `turbo.json`.
- `apps/web`: Next.js app and UI runtime.
- `apps/stripe`, `apps/drizzle-studio`: local dev utilities and integrations.
- `packages/auth`, `packages/db`, `packages/blocknote`: shared TypeScript packages used across apps.
- `tooling/*`: shared configs (e.g., tsconfig).

## Build, Test, and Development Commands

Run commands from the repo root with pnpm.
- `pnpm dev`: start all dev tasks via Turbo.
- `pnpm dev:next`: run the Next.js app in watch mode.
- `pnpm build`: build all packages/apps.
- `pnpm check`: run Biome checks (with write/unsafe) across the repo.
- `pnpm typecheck`: run TypeScript type checks across the repo.
- `pnpm db:push`: apply Drizzle migrations (uses `.env`).
- `pnpm db:studio`: open Drizzle Studio (uses `.env`).

## Coding Style & Naming Conventions

- Indentation: 2 spaces, double quotes (enforced by Biome).
- Lint/format: Biome (`biome.json`), run `pnpm check` before PRs.
- TypeScript is the default; compiled output is in `dist/` for packages.
- Package naming uses the `@acme/*` workspace scope.

## Testing Guidelines

No dedicated test runner is configured in the workspace scripts. Use `pnpm typecheck` and `pnpm check` as the primary quality gates. If you add tests, document the runner and add a `test` script at the package or root level.

## Commit & Pull Request Guidelines

Git history uses Conventional Commit-style prefixes (`feat`, `fix`, `chore(deps)`), sometimes with scopes (e.g., `feat(journl-agent)`), and PR numbers (e.g., `(#154)`). Follow this pattern.
- Keep commits small and focused.
- PRs should include a clear description, linked issues, and screenshots for UI changes.
- Mention any new environment variables or config steps.

## Configuration Tips

Most apps load environment variables via `.env` (see scripts using `dotenv -e ../../.env`). Ensure local `.env` values exist for database, auth, and Stripe settings referenced in `turbo.json`.
