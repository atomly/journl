# Behavior, menus and preservation

Screenshots describe visual states. The local scene script demonstrates only menu opening, focus return, navigation collapse, assistant expansion and resizing. It does not implement persistence, authentication, billing, AI, or complete application flows. The following behavior is an implementation contract, not a claim that the scene script implements it.

## Navigation and Library

The route header identifies the current route. The brand appears once in the full application shell. Do not add a redundant Focus writing action. Library has All pages and Folders tabs and name search. Page rows show actual folder membership, never an invented modified-date field. Folder rows show meaningful contents metadata. The synthetic marketing fixture has three separate folders: Projects, Recipes and References.

Source-backed menus:

| Trigger | Full contents | Source |
|---|---|---|
| Root Library add | New page; New folder | `apps/web/src/app/(app)/@appSidebar/_components/app-sidebar-tree-actions.tsx` |
| Folder actions | New page; New folder; Move up; Move down; Move to…; Delete folder | same file, plus `use-tree-item-moves.tsx` |
| Page actions | Move up; Move down; Move to…; Delete page | `app-sidebar-page-item.tsx`, `use-tree-item-moves.tsx` |
| Move destination | Search field “Find a folder”; Library and valid folder paths; Current marker and disabled current destination; Cancel | `apps/web/src/components/tree-move-actions.tsx` |

Move up/down are disabled without an adjacent sibling or while pending. The picker omits self/descendant destinations. Choosing a destination begins the move; it is not necessary to invent a second Move here step. Move state survives source-row unmount. Pending/error/focus live outside the row. A failed optimistic move restores the prior order. Folder rename is an inline folder-name action, not an item in the production folder menu. The inventory's old “Open” and “Rename” menu items are reconciled to their actual trigger locations without removing those capabilities.

Deletion requires a named confirmation. Failed deletion restores the item and offers retry. Folder deletion includes contents and preserves its background cleanup contract. Page title and body share one save queue. Creation and rename retain entered values when validation or transport fails. Long names wrap in details and confirmations.

On fine-pointer hover-capable desktop, row ellipses have opacity 0 at rest. Their buttons, accessible names, layout slots and tab order remain. Hover, focus-within, focus-visible and menu-open reveal them. Touch, coarse pointer and no-hover devices always show 44px targets. Do not use display:none or visibility:hidden for these triggers.

## Independent panels and scrolling

Navigation defaults to 216px with a 192–280px resize range. Its collapsed rail is 64px. The assistant defaults to 480px, with an explicit 704px expanded state. A usable resize range is 400–704px at the requested wide desktop viewport; smaller windows switch to the sheet arrangement. Expanding the assistant must not change navigation's stored collapsed state or preferred width.

Pointer drag and separator arrow keys resize panels. Arrow keys use 16px increments. Clamp to the supported range. Preserve each panel's draft, selected sources, selected thread, text selection, conversation position and content scroll. Closing and reopening changes visibility, not document identity. Do not unmount dirty editing sessions to toggle layout.

Content panel and navigation end at the same baseline: y=984 for a 1440×1000 viewport, y=832 for the mobile viewport. Ask Journl floats inside the panel at bottom-right, inset 24px desktop / 16px mobile. It has no reserved dock row. Inner trailing padding, scroll padding and focused-control scroll margins use 112px clearance. Final actions must move above or beside the pill. Conversation and composer are separate flex regions; the composer does not cover messages.

## Editor and references

Preserve all 70 baseline editor states plus the added compatibility illustrations. Current implementation pointers are `apps/web/src/components/editor/document-editor{,-view}.tsx`, `document-toolbar.tsx`, `block-actions.tsx`, `table-menu.tsx`, and `packages/better-editor/src/{engine,ui}`. The older inventory's BlockNote paths describe compatibility history, not permission to restore that implementation.

Complete current block actions: Indent; Outdent; Duplicate block; Move block up; Move block down; Copy block link; Delete block; Undo; Redo. Table context substitutes table-specific deletion. Availability follows editability, target validity, selection shape, nesting and history. Duplicating generates fresh subtree IDs. Moving and undo retain existing IDs and order. ContextMenu/Shift+F10 opens block actions. Native link, selected-text, pen and touch menus are not replaced by the desktop custom menu. Touch block handles support a bounded move/cancel flow.

Block choices: Text, Heading 1–6, Bullet list, Numbered list, Checklist, Toggle list, Toggle heading, Quote, Code, Divider and Table. The complete list is illustrated, not a four-item representative slash menu. Filter, empty, loading, error and disabled states remain explicit.

The accepted editor inventory also requires reference and legacy media/emoji/AI compatibility. Current `defaultSlashItems()` maps only block choices; it does not prove those other commands are currently configured. Reference insertion/display actions are available through the current toolbar and reference controls. The reference-slash illustration is a proposed compatibility restoration, not a claim of current configured behavior. Do not silently remove accepted content because a current command is absent. `docs/editor-inventory/README.md` is the preservation checklist for that discrepancy.

Formatting: bold, italic, underline, strike, inline code, text and highlight colors, type, alignment, indentation and links. Stored arbitrary supported colors and justify alignment remain data even if not all are exposed as default toolbar buttons. Named palette colors are Default, Gray, Brown, Red, Orange, Yellow, Green, Blue, Purple and Pink. Selection is retained through menu invocation and restored before applying a change.

Table controls cover row/column selection, insertion, deletion, movement, column sizing, header row/column, cell selection, merge/split, empty/read-only tables and whole-table deletion. Merge requires a rectangular compatible selection. Split requires a merged cell. Cancel restores the previous order/size. Read-only tables keep selection/copy without mutation actions. State images split long menus into named, readable regions rather than shrinking them.

References preserve stable document/block targets across native link, inline mention, card and internal embed display. The display menu omits the current form and invalid conversions. Table references have stricter display capabilities. Source open/copy, hover and keyboard preview, unavailable/deleted targets, depth/cycle limits, collapsed previews, pagination and backlinks states are all retained. Current embeds set a maximum depth of two. Async insertion/conversion rechecks the captured document and selection. A stale result cannot resurrect a deleted block or replace later edits.

Stored media retains URL, name, caption, alignment, preview dimensions and recovery data. Images keep their intrinsic ratio and full frame. Video/audio use native controls or explicit unavailable-source feedback. Safe file links survive a failed inline preview. This package does not invent an upload service, document import UI, comments, sharing or collaborative presence.

Local undo/redo and input/clipboard behavior remain the editor engine's responsibility. Preserve rich clipboard priority, Markdown/text fallback, code-block plain paste, nesting, stable IDs, URL paste/drop resolution and all supported reference atoms. Keyboard history is not a durable server version-history product. The added history image illustrates local undo/redo only.

## Drafts, recovery and AI review

Save batches retain their original loaded version. Title and body are serialized together. An ambiguous response retries against that version so the batch cannot be applied twice. Drafts survive app navigation, virtualized row unmount and editor remount. Save errors never cause a reload. Offline edits show a persistent notice and resume saving on reconnect unless there is a confirmed conflict.

A confirmed conflict requires an explicit choice. “Keep both and load saved” first retains the exact rich draft, then loads the saved version. It is disabled offline. Loading failure, deleted original, newer local edits and download failure keep recoverable copies. Rich JSON downloads include title, blocks, references and format/version metadata. Kept drafts support read-only view, selection/copy, hide, download and explicit removal. They live in the current tab, not durable local storage. Refresh/close can lose them, so retain the warning. No backup import UI is claimed.

AI compatibility illustrations cover loading, proposal review, apply, reject, cancellation, retry/error, stale selection and missing target. Unaccepted proposals stay outside accepted saves, derived search and embedding content. Apply commits once and has one undo group. Reject/cancel preserves the original without silently replacing newer writing. The images do not establish backend/adapter acceptance for A01–A05 or make a live model call.

## Chat, Explore and account boundaries

Chat retains empty/populated, context/source selection, streaming/thinking/stopped, partial/error/retry, edit/cancel, branches, copy, tools, usage limits and unread states. A send error keeps the draft. Stop keeps partial output. Source chips can be removed with an explicit control. Retry targets the relevant turn; branching keeps prior answers. Mode and usage are conditional on actual configuration and account state. Tool stills show pending work rather than fabricated completed results.

Explore retains list and graph views, filter/search/order, refresh/stale/loading/empty/error, paginated notes/sources/connections, thread rename, evidence excerpts, source context, selected nodes, traversal and preview states. Keep evidence attached to its original source. A graph is a real SVG in the design scene, not an empty container. Search, filters and pagination retain their state on return.

Auth preserves provider configuration, invitation-only access, password component/configuration boundaries, intercepted dialogs, reset/verification/loading/validation/errors and redirect/return paths. Provider-hosted consent is external. Account preserves profile, avatar, email, password, provider links and session revocation states. Do not remove the last login method. Billing shows only configured account/plan actions. Hosted checkout and billing portal are external. The review cannot test payment, revoke a real session or mutate a real account.

## Overlay geometry and focus

Desktop row menus use a 288px popover. Editor popovers use up to 400px. Their anchor is the actual triggering control. Placement chooses available space above or below and clamps the surface inside the viewport. The trigger remains visible while its menu is open. No menu is inserted into document flow.

On mobile, menu sheets keep the document visible behind a scrim and use at most 65dvh. Their header and close control remain visible while their body scrolls. Modal dialogs stay within 12px of the mobile edges and 24px of desktop edges. The body scrolls independently of persistent form actions. Escape and the named close control restore focus to the trigger. Native modal focus containment and explicit menu focus cycling keep keyboard users inside the active surface.

Source-backed recovery surfaces come from `save-status.tsx`'s Dialog, with draft sections, retained-copy views and recovery actions inside it. The persistent offline/failure notice stays outside the dialog as its own surface. Auth and subscription intercepted routes are modals over their parent context; standalone routes remain full pages. Account session revocation and reauthentication are modal decisions, while ordinary profile/password fields remain account route content.

The retained `block-action-delete` and `table-state-delete-confirm` inventory states show proposed bounded confirmation guards. Current BetterEditor commands delete directly; these guards are a design proposal, not a claim about a current production dialog. The underlying delete/undo capabilities remain unchanged. Destructive confirmation and menu labels use destructive text and explicit naming rather than mint primary styling.
