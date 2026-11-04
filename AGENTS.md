Read [README.md](README.md) for setup and commands.

- Use mise and the pinned pnpm version. Use `virtualStoreType: project` with pnpm’s shared content store. Do not interpolate YAML enum values or relocate dependencies outside the checkout. Clear generated Next caches after layout changes.
- Declare dependencies and peers in package manifests. Use explicit missing peer declarations instead of `addMissingPeerTypes` or `.pnpmfile.cjs`, hoisting exceptions, vendor patches, or readers of pnpm's internal metadata.
- Run the existing Playwright tests directly. Install their browser binaries and OS dependencies when needed. Do not create Docker validation wrappers, copied CI workspaces, custom test images, or global npm tool installs.
- Use Docker only for test services that need it. Preserve running workloads, database volumes, Workflow data, and useful failure evidence. Inspect stopped containers before removing them; never blanket-prune volumes.
- Stop builds and servers before cleaning caches. Keep persistent Workflow state outside `.next`. Preserve `.workflow-data` and any legacy `.next/workflow-data` before builds or cleanup. Keep reports once, avoid nested artifact copies, and remove temporary resources after success, failure, or cancellation.
- Cache production output only. Exclude `.next/dev` and Workflow state from Turbo caches and build artifacts.
- Before Next.js changes, read the installed guides in `apps/web/node_modules/next/dist/docs`. Keep Next-generated guidance out of the change set.
- Use Turbopack. Do not add Webpack overrides or loader/watch-path patches to conceal unsupported dependency layouts. Verify production builds after toolchain changes.
- Run `pnpm test:ci` locally when cloud CI is unavailable. Report actual failures and skips; never imply browser acceptance passed from unit tests or static checks.
- Keep BetterEditor independent of Journl behavior, routes, persistence policy, menu choices, and styling. Consumers compose the experience. Do not add library presets or component-injection providers.
- Keep one BetterEditor package with explicit leaf exports and no barrels. Keep document/reference dependencies for now; do not add a second stored-content schema or speculative AI/server abstractions.
- Preserve draft/history, stored identities, selection, accessibility, read-only enforcement, and gesture cancellation. Resolve retained actions against current editor state.
- Prefer narrow subscriptions, targeted transactions, bounded geometry work, and optional presentation/highlighting. Measure performance and bundle claims.
- Keep durable guidance here and API examples in package READMEs. Do not add audit diaries, historical validation Markdown, or duplicate plans. Keep temporary logs outside tracked source.
- Legacy BlockNote remains only for the existing AI integration and compatibility tests. Do not add consumers; removal follows the AI replacement tracked in #374–#376.
- Keep reusable UI primitives in `@acme/ui` and app compositions in Journl. Use native Base UI `render`, explicit non-native button semantics, and real styled links for navigation. Do not reintroduce owned `asChild` shims or Slot adapters. Verify shadcn install destinations with a dry run.
