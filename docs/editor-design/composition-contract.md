# BetterEditor composition contract — proposal

Status: design record for the composition implementation. The package README
documents the implemented interface; remaining work is distinguished below.

This follows the module audit. The merged baseline is main commit
643d82dbc55f7abc0443a8f440da0793d9fa17af. Local source has the same tracked tree.
The historical audit uses earlier names; the package is now `@acme/better-editor`.

## Goal and limits

Consumers should build a minimal editor, a compact composer, a document editor,
or a read-only view using the same engine and independently imported React parts.
Journl should compose its own experience without library forks, runtime component
injection, app-specific CSS assumptions, or copying internal gesture code.

Keep one package with engine, UI, and serialization namespaces. Keep explicit
package subpath exports. Keep the current document/reference dependencies during
this work. Do not introduce a second storage schema or replace AI functionality.
The examples show the intended composition. The package README is authoritative
for current names and optional features.

## Three supported entry points

1. Engine: DOM lifecycle, Tiptap extensions, ProseMirror commands and plugins.
   React and menu presentation remain optional.
2. React parts: a lifecycle hook, a root sharing the stable editor instance,
   a content part, and optional controls/menus. Consumers choose JSX order.
3. Ready-made preset: retain `DocumentEditor` as a composition of those parts.
   Consumers wanting small changes can use exported default item collections;
   consumers wanting a different experience compose parts directly.

Do not create a giant preset props object with a replacement slot for every child.
Do not restore EditorUIProvider or a component-name-to-component map. Root context
holds stable editor services, not changing document snapshots. Permit explicit
editor props for parts rendered outside that context.

## Composition surface for the first implementation

| Surface | Consumer choices | Library guarantees |
| --- | --- | --- |
| Root/content | DOM props, ref, labels, classes, content placement, read-only/editable | One editor instance, selection/history preservation, correct accessibility attributes |
| Formatting toolbar | Inline, floating, or sticky; visibility policy; anchor/side/alignment/offset; portal container | Selection-safe activation, roving focus, relevant geometry updates |
| Toolbar items | Add, remove, reorder, group; labels, icons, shortcuts, tooltips, custom controls | Command hooks and accurate active/disabled state |
| Popups | Trigger, content, grouping, controlled/uncontrolled open state, portal/collision options | Focus return, Escape, keyboard navigation, editor ownership |
| Block handles/menu | Handle trigger and menu contents, target block, visibility behavior | Stable target identity, touch/mouse/keyboard gesture ownership |
| Slash menu | Item collection/provider, filtering/ranking, groups, labels/icons, result/empty/loading/error rendering | One result model for keys, active item, pointer selection, and execution |
| Context menu | Item composition, grouping, target | Operates on intended target without losing text/cell selection |
| Table controls | Row/column trigger/menu contents; available actions and placement | Cell/axis targeting, resize/drag behavior, selection, native undo |
| References | Optional views/actions, consumer resolver/navigation and preview services | Safe insertion and preservation of existing reference content |
| Code blocks | Optional language picker, language collection, highlighting feature | Text editing, clipboard preservation and schema correctness |
| Errors/read-only | Consumer error/recovery parts; static preview | No promised app recovery screen; no unnecessary editing controls |

Appearance defaults remain accessible and neutral. Expose className, style, refs,
ARIA/data attributes, and element composition where appropriate. Behavior-bearing
triggers use Base UI's render prop with correct event/prop/ref merging. An arbitrary
wrapper must not create nested buttons or break keyboard focus.

## Toolbar placement and responsive behavior

Separate positioning from visibility. Proposed toolbar options:

- `mode`: inline, floating, sticky. Sticky uses normal layout plus consumer top
  offset; it must not secretly reorder content or infer an app header.
- `visibility`: always, selection, manual. Manual uses controlled open state.
- Floating options: selection/block/explicit anchor, side, alignment, offset,
  collision boundary/padding and portal container. Start with the positioning
  library's established types rather than inventing synonyms.

Consumers decide responsive policy. Changing modes must retain the same editor,
draft, selection, and history. Pointer capabilities and viewport dimensions are
separate concerns: a narrow mouse viewport must not automatically acquire touch
activation rules. Library gesture defaults still detect the actual input device.

Do not require a browser global during server render. Default responsive behavior
must have a deterministic initial render. Portal controls retain the correct
editor's context, owner ID, focus return, and theme when multiple editors exist.

## Proposed JSX experience

The consumer owns `compact` and its responsive policy.

```tsx
import { useBetterEditor } from "@acme/better-editor/ui/use-better-editor";
import { EditorRoot } from "@acme/better-editor/ui/editor-root";
import { EditorContent } from "@acme/better-editor/ui/editor-content";
import { EditorToolbar } from "@acme/better-editor/ui/editor-toolbar";
import { BoldButton, ItalicButton } from "@acme/better-editor/ui/mark-button";
import { LinkMenu } from "@acme/better-editor/ui/link-menu";
import { SlashMenu } from "@acme/better-editor/ui/slash-menu";

const { editor } = useBetterEditor({ initialBlocks, extensions, editable, onCommit });

return (
  <EditorRoot editor={editor}>
    <EditorToolbar
      mode={compact ? "sticky" : "floating"}
      visibility={compact ? "always" : "selection"}
      className="article-toolbar"
    >
      <BoldButton aria-label="Bold" />
      <ItalicButton />
      <LinkMenu />
      <ConsumerAction />
    </EditorToolbar>
    <EditorContent aria-label="Article" />
    <SlashMenu items={articleCommands} />
  </EditorRoot>
);
```

Expose headless command/state hooks so consumers can implement ConsumerAction with
ordinary JSX. They should not need to duplicate focus and selection-preservation
logic. The preset must use the same public parts as consumers.

## Actions and menu collections

Prefer a small shared action model over parallel toolbar/slash/context command
implementations. Actions have a stable ID, execute behavior, a cheap applicability
check, and optional selected state. Labels, icons, grouping, and shortcuts belong
to UI descriptors. Keep React elements out of engine action definitions.

The same action can appear in several presentations. It runs against fresh editor
state and an explicit target. Block menus retain a target block ID; they do not
silently switch to the current caret's block when a popup receives focus. Complex
commands use a prepared selection/target bookmark mapped through intervening
transactions. Removed/incompatible targets close or disable safely.

Disabled/active checks must not build a transaction or serialize the document.
Custom consumer items can share these command/state hooks, or perform application
actions with their own handlers. Do not require every menu child to be registered
in a global action registry.

Export immutable default descriptor collections with stable IDs. Support filtering,
reordering, grouping, and adding consumer items without modifying globals. A
hidden UI item does not disable its keyboard command. Disabling a command is
separate from removing its schema support. Missing features yield unavailable
commands, not invalid content or disappearing stored nodes.

## Slash-menu agreement

The current engine and UI both call filteredBlockChoices independently. Replace
that duplication before allowing custom collections. Otherwise ArrowDown/Enter
can execute a different item than the visible or announced active item.

One controller owns query, trigger range, target, result IDs/order, active ID,
loading/error state, and execution. The view consumes that snapshot. Click and
keyboard activation use the same selected ID. Group headings and disabled entries
do not corrupt navigation indexes. Empty results, Escape, blur, IME, and range
mapping have defined behavior. Removing the menu must also disable its trigger
handling; it must not consume slash navigation keys without a mounted consumer.

Support static collections and a source function for results. An async source can
receive an AbortSignal. Superseded results must not replace a newer query, and
late completion after close/destroy must not act on stale ranges. This enables
reference or future AI choices without implementing those products now.

UI item changes may update the result collection without rebuilding the editor.
Schema changes cannot use the same mechanism. Search/ranking must run once per
query/source update, not once independently per React control and keyboard event.

## Lifecycle contract before composition expands

Separate these categories explicitly:

- Initial state: initial content and schema/feature extensions. Equivalent array
  identities must not reset a draft. Real schema changes require an explicit,
  validated reconfiguration/remount, never an implicit reset to original content.
- Live options: editable, callbacks, labels, menu items, presentation and services.
  Callback presence must not determine editability.
- Deliberate document change: explicit reset/load with defined history/selection
  behavior. Preserve recovery copies and do not confuse save acknowledgement with
  loading a new document.

Lifecycle ownership belongs in the hook/root contract; UI parts never destroy the
editor. Handle Strict Mode, mount errors, and teardown. Keep content validation
failures distinct from consumer callback and persistence errors.

## Performance requirements alongside composition

Composition must not add a document snapshot to React context or subscribe every
button to every transaction. Use selectors for active marks, target IDs, command
availability, and query results. Share the existing Tiptap instance rather than
creating a second wrapper state model for all its internals.

Prioritize these implementation changes:

1. Convert a changed document once. Remove repeated whole-document location-map
   construction and avoid repeated full validation while producing each operation.
2. Add a fast path for a local content/mark edit using transaction information and
   unchanged node identity. Preserve an equivalence-tested full-diff fallback for
   structural/replacement cases before expanding incremental handling.
3. Separate cheap capability checks from transaction creation. Introduce selector
   subscriptions before extracting many toolbar buttons.
4. Replace broad structural document replacements with targeted transactions in
   a distinct reviewed change. Test stable IDs, native history, selection mapping,
   nested moves and child survival before removing the old conversion path.
5. Move pointer hit testing and reference updates toward bounded/targeted work.
   Make highlighting optional and inspect the resulting bundles.

The original single-character diff probe measured about 285 ms at 1,000 paragraphs
and 724 ms at 2,000 on this host. These are not browser typing measurements.
Create a permanent, reproducible benchmark before setting enforced time budgets.
Measure 100/1,000/5,000 blocks, nested structures, tables and reference-heavy
content. Record median/p95, allocations, React commits and production browser
input-to-paint measurements on pinned hardware. Small edits should not trigger
quadratic work or re-render unrelated controls; operation correctness is a gate.
Do not debounce unsaved-change tracking or weaken validation to meet timing goals.

A minimal consumer import should not pull in optional menus, drag UI, all syntax
languages, reference views, or app services. Prove this with bundle/import-graph
checks. Separate registry items can copy optional parts while still using one
source package. No publishing is required.

## Compatibility and local acceptance

Maintain stored document/operation correctness and raw recovery data throughout.
Keep the current save adapter while establishing an editor change seam; do not
make the new UI parts depend directly on DocumentOperation or ReferenceClient.
Existing dependencies may remain behind integration/preset modules until a later
decoupling change. Retain current table/clipboard/reference preservation tests.

For the first implementation, verify:

- Minimal content-only editor, full preset, and a consumer-defined toolbar/menu.
- Floating and sticky presentations selected by consumer policy, changed live
  without destroying the editor or losing selection/history.
- Custom/reordered/disabled slash items agree for pointer, Enter, arrows and ARIA.
  Stale async results and removed targets cannot execute.
- Keyboard focus, popup dismissal, custom trigger refs, read-only/editable changes,
  IME, touch drag, cell selection, and two simultaneous editors.
- Consumer styles are optional; no app header offsets, routing rules, save notices,
  font choices, or component injection are required by standalone parts.
- Explicit subpath exports, shadcn source installation and standalone compilation.
- Unit/operation tests, database integration, actual-app Chromium/WebKit, frozen
  install, lint/typechecks and Turbopack production build run locally while cloud
  CI is blocked by billing.

## Suggested review sequence

First agree on the composition surface, action/target model, and lifecycle rules.
Then take performance and lifecycle changes in small reviewed increments before
or alongside the React extraction. Rebuild Journl with the public parts to prove
the interface against a real consumer. Treat full document/reference decoupling
and AI replacement as separate work; this draft does not set their final order.

## Sources

- [Tiptap selector subscriptions and React performance](https://tiptap.dev/docs/guides/performance)
- [Base UI composition, prop/ref merging and custom triggers](https://base-ui.com/react/handbook/composition)

## Local baseline status

The fresh merged-baseline run passed lint, dependency checks, typechecks, registry
checks, 415 unit tests, and 43 database tests. Browser acceptance stopped at the
desktop table-accessibility test: it expected Saved but saw Couldn’t save. The
trace records an aborted save, a connection reset, then connection refusals from
the dev server. Root cause is not established. There were 37 browser passes, two
skips, and 84 cases not run. Production build did not run after that failure.

The isolated retry stopped on cold initial navigation before reaching the table
actions. The navigation setup now permits cold compilation, and the harness logs
unexpected server exits. This is not a passing full baseline.

## Implementation and remaining work

The implementation adds root/content parts, explicit toolbar modes, command hooks
and buttons, a link menu, replaceable block/table menu contents, shared synchronous
and asynchronous slash results, explicit resets/live editability, and consumer
services for links/navigation. It preserves the full preset.

Performance work includes immutable cached node payloads, a linear data-only diff,
targeted structural steps with atomic failure, optional highlighting, selector
subscriptions, and reduced node-view update/listener fan-out. Snapshot delivery
remains linear because the existing consumer contract includes full block arrays.

The stored schema and document/reference dependencies remain. Fully optional schema
features, transaction-mapped indexes, bounded gutter hit testing, and per-feature
registry items remain separate optimizations requiring measurements and compatibility
review. No AI replacement or second storage schema is part of this implementation.
