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

This tests every story in Chromium and WebKit. `test:stories` exposes that command.
Install browsers with `mise exec -- pnpm exec playwright install --with-deps
chromium webkit` when needed; OS dependencies can need administrator access.
With Storybook running, run additional browser checks:

```sh
COMPONENT_REVIEW_URL=http://127.0.0.1:<port> mise exec -- pnpm test:browser
```

These cover 1440×1000, 834×1112 and 390×844 in light/dark, plus Chromium
forced-colors and reduced-motion emulation. They verify system selection colors,
field geometry, opaque fallback and Brand's mask. Screenshots and traces remain
in ignored `test-results/`. Route parity, real-device behavior and screen-reader
acceptance remain separate work.

Toolbar globals select theme, transparency and motion. Explicit dark/opaque
stories allow automated checks. Viewport presets match approved capture sizes.
Docs and Controls use real props. Navigation examples use genuine styled links;
non-native button examples explicitly declare their semantics.

Canonical anchors: `buttons`, `fields`, `focus-ring`, `transparency-reduced`,
`forced-colors`. Read-only references are in
`/tmp/journl-approved-implementation/docs/design-handoff/views/shared/`, named
`<state>--<theme>--<device>.png`. Ownership: `/tmp/journl-uiux-review-gates.json`.
Story docs repeat relevant IDs. Those PNGs include the shell; isolated stories
do not establish shell acceptance.

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
