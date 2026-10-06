# project

2026-10-06, whole-project transformation-engine migration and dependency refresh. App-owned Radix wrappers now use Base UI.

## Changed

- Migrated 22 app-owned wrappers listed in the component reports; updated `components.json` to `"base": "base"`.
- Added `@base-ui/react`; removed all app-owned direct Radix packages from `apps/web/package.json`.
- Upgraded workspace dependencies to current releases, with compatibility pins where upstream peer ranges prohibit the newest major (Stripe 22 for Better Auth; other pins are documented in manifests).
- Added the Better Auth 1.7 schema fields for user Stripe customer IDs, subscription cancellation/billing metadata, and invitation creation timestamps.
- Apply the additive database schema changes through the project's normal `db:push` deployment workflow before deploying the upgraded auth package.
- Better Auth UI now follows its shadcn registry model: auth and settings views/provider code live under `apps/web/src/components/auth`, with only `@better-auth-ui/core` and `@better-auth-ui/react` retained as shared logic packages. The old `@daveyplate/better-auth-ui` component/server imports are removed.
- `components.json` uses the Base UI `base-nova` style and the Better Auth UI registry alias. Invite-only social sign-up remains on the local view and passes the validated invite code as additional user data.
- Added BlockNote's Yjs peers, which its server utility imports during the production build.
- Typecheck, Biome check/format, Vitest (59 tests), and the production build pass. The build logs expected plan lookup errors because this environment has no database at the placeholder `POSTGRES_URL`.

## Left alone

- Vaul drawer, cmdk command palette, React Day Picker calendar, and Sonner notifications remain on their existing non-Radix libraries.
- BlockNote's AI SDK 6 tool type is adapted at the AI SDK 7 boundary; BlockNote currently ships its own AI SDK type dependency.

## Behavior changes

- Base UI Tabs uses its own activation behavior; manually verify keyboard activation.
- Navigation Menu uses Base UI popup positioning and activation timing.
- PopoverAnchor is unused in the app and remains a native span compatibility export.

## Verify by hand

- Tab through dialogs and verify focus trapping/return.
- Open select and menu popups; test arrow keys, typeahead, Escape, and outside dismissal.
- Check tooltip delay and all popover/select/menu placement at viewport edges.
- Check sidebar collapse and accordion/tabs behavior.
