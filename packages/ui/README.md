# Shared UI

Reusable shadcn/Base UI primitives live in `src`, with explicit leaf exports such
as `@acme/ui/button`. There are no competing primitive copies in the web app.
Consumers use Base UI's `render` prop. Set `nativeButton={false}` explicitly when
a button primitive renders a non-button control. Navigation uses a real Link or
anchor styled with `buttonVariants`.

Both workspace `components.json` files select `base-nova`. From the repository
root, inspect `pnpm dlx shadcn@latest info --cwd apps/web` and use
`pnpm dlx shadcn@latest add <name> --cwd apps/web --dry-run` before installing.
Registry UI files resolve to `packages/ui/src`; application compositions resolve
to `apps/web/src/components`. Add a leaf export when installing a new primitive.
Review diffs before overwriting intentional theme classes, sizes or animations.

The wrappers follow the [official Base UI sources](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/bases/base/ui).
Intentional exceptions:

- Journl's sidebar, form helpers, document overlay, expanding textarea and swipe
  actions remain in `apps/web/src/components/ui`. The sidebar retains resizing,
  persistence and swipe behavior. FormControl retains React Hook Form field IDs,
  descriptions, validation and focus through native `render` composition.
- Drawer retains Vaul and its genuine trigger API, swipe behavior and existing
  DrawerProvider. A Drawer replacement is separate from removing Radix shims.
- Calendar, carousel, command palette and notifications retain React Day Picker,
  Embla, cmdk and Sonner. These are also normal upstream dependencies.
- The shared Button retains Journl's `background` variant. Popup wrappers retain
  explicit portal containers, positioning options and intentional theme tokens.

Do not reinstall the app's custom sidebar or form helpers from the registry.
Chat uses the [Base UI AI Elements patterns](https://ui.shadcn.com/docs/ai-elements)
through `message-scroller`, `message`, `bubble`, `trace`, `code-block`, and
`input-group` leaf exports. The app owns its AI SDK connection and chat composition.
Message Scroller owns streaming follow and turn anchoring. Code grammars load on
demand. Registry copies retain native Base UI composition and existing app themes.
