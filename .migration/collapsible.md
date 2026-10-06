# collapsible

2026-10-05, transformation engine (legacy new-york style), migrated while preserving wrapper classes.

## Changed

- apps/web/src/components/ui/collapsible.tsx; apps/web/src/app/(app)/@appSidebar/_components/app-sidebar-pages.tsx. Trigger composition maps asChild to render.
- Radix leftover scan: clean in this wrapper; `apps/web/src/components/ui` and app-owned tooltip wrappers contain no `radix-ui` or `@radix-ui` imports.

## Left alone

- `apps/web/src/components/ui/drawer.tsx` remains Vaul; drawer migration was explicitly outside the Radix-to-Base UI migration.
- `apps/web/src/components/ui/command.tsx` keeps cmdk; `calendar.tsx` keeps React Day Picker; toast keeps Sonner.

## Behavior changes

- None intentionally introduced.

## Verify by hand

- Open, close, and keyboard-navigate the component; verify focus returns to its trigger.
- Compare placement, spacing, and open/close animation with the existing UI.

