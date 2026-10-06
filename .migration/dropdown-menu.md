# dropdown-menu

2026-10-05, transformation engine (legacy new-york style), migrated while preserving wrapper classes.

## Changed

- apps/web/src/components/ui/dropdown-menu.tsx. DropdownMenu now uses Base UI Menu, including the Positioner > Popup model.
- Radix leftover scan: clean in this wrapper; `apps/web/src/components/ui` and app-owned tooltip wrappers contain no `radix-ui` or `@radix-ui` imports.

## Left alone

- `apps/web/src/components/ui/drawer.tsx` remains Vaul; drawer migration was explicitly outside the Radix-to-Base UI migration.
- `apps/web/src/components/ui/command.tsx` keeps cmdk; `calendar.tsx` keeps React Day Picker; toast keeps Sonner.

## Behavior changes

- Base UI keyboard activation, popup timing, and item dismissal can differ from Radix. Verify manually before release.

## Verify by hand

- Open, close, and keyboard-navigate the component; verify focus returns to its trigger.
- Compare placement, spacing, and open/close animation with the existing UI.

