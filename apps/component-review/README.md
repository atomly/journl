# Isolated component review

Vite Storybook renders real `@acme/ui` controls and Journl's app-owned theme and
Brand. It imports no app layout, providers or service credentials. Styles, fonts
and artwork stay in `apps/web`. The only adapter is `src/next-image.tsx` for
Brand's unoptimized static SVGs. Shared UI stays app-independent.

Use mise and pinned pnpm from the repository root:

```sh
mise exec -- pnpm --filter @acme/component-review dev --host 0.0.0.0 --port <available-port> --ci
mise exec -- pnpm --filter @acme/component-review build
mise exec -- pnpm --filter @acme/component-review check
mise exec -- pnpm --filter @acme/component-review typecheck
```

Choose a new available port between 49152 and 65535 each start. Production output
is `dist/`, ignored by Git and cached by Turbo. Build inputs include app-owned
styles, fonts, Brand and artwork. Dev output and Workflow state are not cached.

From this directory, run official interaction and blocking accessibility tests:

```sh
mise exec -- pnpm exec storybook tools test run
```

This tests every story in Chromium. `test:stories` exposes that command.
Install Chromium with `mise exec -- pnpm exec playwright install --with-deps chromium`
when needed. Installing OS dependencies can require administrator access.
Run additional browser checks directly; Playwright starts and stops its own isolated Storybook server on an available port:

```sh
mise exec -- pnpm test:browser
```

Set `COMPONENT_REVIEW_URL` to use an already running review server. The root Turbo
browser task runs story tests first, followed by Playwright checks for system
selection colors, the high-contrast brand mark, and opaque fallback. Failure
screenshots and traces stay in `test-results/` and are uploaded by CI.
Application workflows run in desktop Chromium and mobile WebKit in the app's
functional suite.

Toolbar globals select theme, transparency and motion. Explicit dark/opaque
stories allow automated checks. Viewport presets match approved capture sizes.
Docs and Controls use real props. Navigation examples use genuine styled links;
non-native button examples explicitly declare their semantics.

Canonical anchors: `buttons`, `fields`, `focus-ring`, `transparency-reduced`,
`forced-colors`. The final approved design is in handoff PR #459, commit
`8093f79c`, under `docs/design-handoff/views/shared/` with filenames
`<state>--<theme>--<device>.png`. Use a read-only checkout/export of that handoff;
it remains separate from the implementation stack. Story docs repeat relevant
IDs. Those PNGs include the shell; isolated stories do not establish shell
acceptance.

## Version constraints

Official project-level Storybook skills require Storybook 11 and its skills/tools
commands. Registry stable was 10.6.7; this workspace explicitly pins compatible
published prerelease 11.0.0-beta.3. Revisit when official skills support stable.
This is not a production Next dependency.

Controls/Docs require the TypeScript 6 compiler API alongside native TypeScript 7:
`typescript` aliases `@typescript/typescript6`; `@typescript/native` aliases
TypeScript 7 for `tsc`. The app keeps its existing TypeScript setup.

Foundation defects belong in `uiux/foundations`; report them to its owner rather
than changing or masking behavior here. Keep review isolated from shell/routes.
