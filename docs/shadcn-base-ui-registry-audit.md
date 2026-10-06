# shadcn Base UI registry audit

Audit performed on 2026-10-06 with `pnpm dlx shadcn@latest` and the configured
`base-nova` style. Registry sources were retrieved with `shadcn view` before
any component files were changed. The reviewed local baseline is commit
`3ca1a50`.

## Registry coverage

The latest registry returned source for these 41 local components:

`accordion`, `alert`, `alert-dialog`, `avatar`, `badge`, `breadcrumb`, `button`,
`calendar`, `card`, `carousel`, `checkbox`, `collapsible`, `combobox`,
`command`, `dialog`, `drawer`, `dropdown-menu`, `field`, `hover-card`, `input`,
`input-group`, `item`, `label`, `navigation-menu`, `popover`, `progress`,
`scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`,
`sonner`, `spinner`, `switch`, `tabs`, `textarea`, `toast`, `toggle`, and
`tooltip`.

The current registry has no `form` source. Keep the local `form.tsx` as a
project integration unless a replacement is selected separately. Other files
in `components/ui` that have no matching registry item (for example
`base-slot.tsx`, `document-overlay.tsx`, `expanding-textarea.tsx`, and
`swipe-action.tsx`) are project components and are outside this registry sync.

All 41 registry-backed local files differed from the registry. The 39
components that do not replace a Journl-specific Sidebar or Drawer API now use
the latest registry implementations. The differences include current Base UI
APIs/state attributes and new `base-nova` defaults, not just formatting.
Registry components now import `cn` from the `cn` package; the app's
`~/lib/cn` helper remains available to existing app code.

## Journl customizations to retain or reapply

- **Theme:** preserve the OKLCH light/dark tokens, radius scale, and global
  component CSS in `apps/web/src/app/styles.css`. These define Journl's colors,
  borders, and overall density independently of registry source.
- **Buttons:** keep the `background` variant and app-supported `asChild`
  compatibility. The local design uses `rounded-md`, 36px default buttons,
  accent-based ghost/outline states, and the current destructive treatment.
- **Sidebar:** this is a substantial product component, not a replaceable
  registry snapshot. Preserve desktop resizing/drag handles, off-canvas and
  icon modes, keyboard shortcuts, persisted width/open preferences, mobile
  Sheet behavior, tooltips, and the existing sidebar slot styles.
- **Drawer and mobile detection:** the local Drawer is a Vaul-backed app
  controller that exports `DrawerProvider`, `useDrawer`, and custom dividers;
  the registry's Base UI Dialog replacement removes those APIs. The registry
  CLI also proposed replacing `use-mobile.ts`; that hook is app-specific and
  remains at its baseline implementation. Both files were restored after
  reviewing the registry diff.
- **Sheet:** preserve all four `side` positions, the close control, and the
  app's z-index contract in `apps/web/src/app/(app)/styles.css`. The backdrop
  and popup currently use Base UI `data-starting-style` / `data-ending-style`
  transitions to avoid the mobile close flash. The stronger `bg-black/50`
  backdrop and 300ms transition are retained over the latest registry's lighter
  150ms backdrop.
- **Calendar:** preserve the local default caption mode, outside days, ghost
  navigation buttons, locale month formatting, DayPicker class names, and the
  optional `buttonVariant` API.
- **Sonner:** retain the theme integration, custom status icons, CSS variables,
  and `cn-toast` class used by app styling. The registry sync currently has
  only the theme integration; reapply the icons, variables, and toast class
  from the baseline if those are still desired.
- **Existing composition APIs:** Button, Collapsible, Dialog, Dropdown Menu,
  Navigation Menu, Tooltip, and Sidebar retain `asChild` compatibility while
  using Base UI `render`. Badge and Breadcrumb now expose Base UI's `render`
  prop; no current app callsites use their previous `asChild` prop.
- **Other product classes:** the baseline snapshot at commit `3ca1a50` is the
  exact source of local component classes and wrapper props before registry
  synchronization. Refer to that revision when restoring any finer-grained
  visual differences discovered during review.

## Review notes

The registry's latest `base-nova` defaults change component density, radii,
button sizes, focus rings, and interaction styling. Treat those as upstream
defaults unless a Journl-specific customization above or in the baseline
snapshot says otherwise. Review changes to the sidebar separately because its
local behavior is substantially beyond the registry component.
