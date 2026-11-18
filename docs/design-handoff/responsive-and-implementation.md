# Responsive and implementation guide

## Breakpoints and capture sizes

| Range | Layout |
|---|---|
| Up to 700px | 12px floating inset. Navigation is a modal sheet. Assistant occupies the available panel as a sheet. 44px touch controls. Single-column forms and menus. |
| 701–1100px | 16px inset. Navigation becomes a 64px rail. Assistant uses the full content stage when open. Main content gets 32px padding. Marketing reorganizes into a single-column hero. |
| 1101px and wider | 216px navigation, 16px gaps, independent 480px/704px assistant. Reading column caps at 680px. |
| Marketing width below 1360px | Preserve 32px outer material margins and 64px narrative margins until the mobile stack. |

Canonical requested viewports are 1440×1000 and 390×844 in both themes. Tablet captures at 834×1112 cover layout-changing Library, Journal, editor, graph, account and assistant views. Secondary full-page captures can be taller than the viewport. The manifest records viewport and raster dimensions separately. No raster is stretched to pretend it came from another viewport.

Keyboard-aware mobile implementation must follow the current app's `interactive-widget: resizes-content` contract. Respect visual viewport changes and safe-area insets. Keep save/recovery controls reachable with the software keyboard open. The design scenes use touch emulation; real iOS keyboard, IME, selection handles and orientation remain device acceptance work.

## Mapping and source ownership

`screen-state-index.json` and CSV map every baseline state to new PNGs. `coverage-matrix.json` adds current source pointers and retains historical current-browser status. An inspected source is never upgraded to captured. All new renders await review. Historical captures and approved originals remain distinct from proposals.

Implementation entry points:

| Family | Current source pointers |
|---|---|
| Global shell | `apps/web/src/app/(app)/@appSidebar`, `@header`, `@chatSidebar` |
| Journal | `apps/web/src/app/(app)/journal` and dated route |
| Library | `(app)/pages`, `(app)/folders`, sidebar tree and `components/tree-move-actions.tsx` |
| Editor | `components/editor/document-editor-view.tsx`, `document-toolbar.tsx`, `block-actions.tsx`, `table-menu.tsx` |
| Content engine | `packages/better-editor/src/engine` and `packages/document` |
| References | `components/references`, `components/editor/reference-actions.tsx`, BetterEditor reference UI |
| Recovery | `document-draft.ts`, `draft-sessions.ts`, `draft-activity-provider.tsx`, `save-status.tsx`, `draft-recovery-actions.tsx` |
| Explore | `(app)/explore/_components` |
| Chat | `components/assistant-ui`, `apps/web/src/ai/tools` |
| Auth/account | `components/auth`, `(dashboard)/auth`, `(dashboard)/account`, intercepted auth routes |
| Billing | `(dashboard)/subscription`, header subscription actions |
| Marketing | `(marketing)/page.tsx` |

Exact source hashes and line evidence are in `evidence/current-source-index.json`. These paths point into the read-only production repository. They are not copied implementation modules. Source state can change after this handoff; compare hashes before coding.

## Component contracts

Build semantic tokens before application components. Keep navigation selection, keyboard focus, hover and menu-open as separate states. Use one source for action availability. Reuse menu actions between Library and sidebar rather than deleting actions from one presentation. Keep overlay placement outside virtualized rows when a mutation can unmount the trigger.

Panel preferences and document sessions have different lifetimes. Collapsing, resizing or changing route presentation cannot discard drafts, selections, context or scroll. Preserve the authoritative save engine. The local review script is not a replacement for the current route, cache, tree, content or draft machinery.

Keep read-only rendering loss separate from stored-data truth. Unsupported blocks and malformed historical structures need recovery, not coercion to empty paragraphs. Preserve IDs, parent/child order, table spans, reference props and original recovery rows. Do not invent a migration based on screenshot frequency.

## Marketing hero contract

The hero image is the exact canonical v5 `all-pages` PNG for the corresponding theme and device. Desktop is 1440×1000, ratio 1.44. Mobile is 390×844, ratio approximately .462085. The complete shell, route header and normal UI scale remain inside the image. CSS uses width:100% and height:auto, with no cropping or fixed alternate aspect ratio. The hero map records PNG paths, dimensions and hashes.

Only the hero and the spacing needed for its natural ratio change. The approved organization-first narrative, use cases, illustrative assistant response, invitation wording, sign-in/invitation actions and footer links remain. The old particle/composition state maps to the corrected static product image rather than reintroducing a rejected wide mock. Fixture folders and notes are synthetic user content, not new application feature categories.

## Implementation gate and remaining acceptance

This package is ready for design review only to the extent stated in its QA report. It does not request production implementation. Direction approval does not individually approve every expanded state.

Known current browser access gaps remain in the retained evidence ledger. No live application browser sessions, database inspection, personal data export, account mutation, payment flow or model call were performed for this expansion. Source inspection and design-scene tests cannot close those gaps.

Real-browser implementation acceptance still needs authenticated route integration, actual save/undo/AI semantics, external provider and billing returns, physical touch/keyboard/IME behavior, screen-reader review and supported browser coverage. These are separate from PNG integrity and scene geometry checks.

## Current repository constraints

The current Journl `AGENTS.md` requires BetterEditor to remain independent of Journl routes, persistence, menu choices and styling. Journl composes the app experience. Keep one BetterEditor package with explicit leaf exports. Do not create a second stored-content schema or a speculative AI/server abstraction.

Keep reusable primitives in `@acme/ui` and app compositions in Journl. Use native Base UI `render` and explicit semantics for non-native buttons. Navigation uses real styled links. Do not restore `asChild` shims or Slot adapters. Preserve drafts/history, stored identities, selection, accessibility, read-only enforcement and gesture cancellation. Resolve retained actions against the current editor state, not a captured stale state.

Legacy BlockNote is limited to the existing AI integration and compatibility tests. New UI implementation must not add consumers. No production implementation was performed in this handoff.

## Contextual surface correction

Menus and popovers are now bounded overlays anchored to actual rows, references, toolbar controls, the route disclosure, avatar or composer. Mobile menus use a bottom sheet capped at 65% of the viewport. Modal forms use a centered dialog with backdrop, internal scroll and a reachable close control; action footers remain outside that scroller. Normal account/auth/billing routes remain routes. Inline folder naming remains inline. The source-classification record on each render identifies route, popover, modal, navigation sheet or supplemental component reference.

Long overlays have overlapping internal-scroll captures. `initial`, intermediate `scroll-N`, and `scroll-end` variants share the same state ID. This preserves the 438-state ledger while showing all controls without expanding the document. Exact PNG regions and variants are recorded in the indexes.

Supplemental component-only plates do not replace contextual UI designs. Toolbar inventory is paired with selection states; button/field plates with auth/account forms; resize diagrams with actual panel states; conditional account/billing plates with their individual source-conditioned states. Native and hosted external boundaries remain separately recorded in the evidence folder.
