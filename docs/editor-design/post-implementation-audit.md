# BetterEditor implementation audit

A read-only subagent audited PR #431 at `34a59f7`, including the tooling setup,
the original module audit, and the consumer-ownership requirements. A second
read-only review checked the corrections below. Neither reviewer edited files.

## Findings and corrections

The audit found two P2 defects:

1. Table-menu actions retained editor states, positions, axes, widths, and
   attributes. Typing before activating a retained action could throw a selection
   RangeError. Actions now resolve current state, verify target identity, preserve
   newer attributes, and cancel safely when the target is unavailable. Independently
   composed menus subscribe to table identity and semantic selection changes.
2. Independently composed table controls could mutate read-only editors, including
   after editability changed during a gesture. Menu actions now enforce read-only
   state. Table gestures hide/cancel on editability changes, and the table-edit
   dispatcher rejects read-only, destroyed, and stale transactions.

The correction review also caught two edge cases before completion: Tiptap emits
`destroy` before its destroyed flag changes, and cell selections can change their
anchor without changing `from`/`to`. Explicit destruction tracking and
`Selection.eq` now cover those cases. The reviewer found no remaining actionable
defect in the corrected scope.

## Tooling

No additional blocking tooling defect was found. Native pnpm type-peer resolution,
devEngines/mise pinning, CI store selection, cache configuration, Renovate parity,
and project-only skill installation agree with the intended setup. Editor registry
generation and hosting are deferred, and no stale Webpack setup or vendor patch
surfaced. The stale present-tense registry-check statement was corrected.

The unused Next.js reader of pnpm's internal `.modules.yaml` was removed. It did
not solve the Workflow limitation. Global-store installation/typechecking works;
app development and builds still need the documented project-store override.

## Original findings

| Finding | Assessment |
| --- | --- |
| 1. Expensive conversion/diffing | Improved, partial. Cached node decoding and linear data-only diffs replace duplicate decoding and quadratic typing work. Full-document checks, indexes, walks, and snapshot cloning remain. |
| 2. Structural whole-document replacement | Addressed for the reviewed commands through targeted transactions and selection/history tests. |
| 3. Monolithic composition | Addressed. Journl owns its assembly; the library supplies independent parts and a stable instance context. No library preset or component-injection map remains. |
| 4. Extension changes resetting drafts | Addressed through mount-time configuration, explicit resets, live options, and lifecycle tests. Toolbar callback changes no longer reset popup focus. |
| 5. Broad subscriptions/availability work | Partial. Shared selectors and independent controls exist; table-menu safety is corrected. Geometry controllers and parts of Journl's toolbar still use full-state subscriptions. |
| 6. Pointer/node-view/reference fan-out | Partial. Toggle listeners and unchanged reference updates are reduced. Gutter scans, document walks, and whole-array reference-store notifications remain. |
| 7. Engine DOM presentation | Open. The engine schema still installs block/table node views, including checkbox/toggle controls. The optional DOM-presentation seam is incomplete. |
| 8. Optional feature assembly | Partial. Engine highlighting is opt-in, but the code UI's language catalog still imports the module registering all grammars. Tables and references remain in the default schema. |
| 9. Consumer behavior/errors | Substantially addressed. Applications own composition, routing, URLs, recovery, reference actions, and embedded rendering. Document/reference dependencies remain by explicit agreement. |
| 10. Public interface curation | Partial. Explicit leaf exports and no barrels comply with the convention. Low-level helpers remain public; export curation and narrower document/reference contracts remain future work. |

The original suggestion to retain a library preset was superseded by the explicit
consumer-owned composition requirement. The remaining items above are not claimed
complete. Browser typing budgets, React commit measurements, mixed-document
benchmarks, and bundle-size comparisons are not established by the current checks.

## Verification of corrections

Parent verification passed 455 unit/UI tests, all ten workspace typecheck tasks,
lint, frozen installation, and an uncached Turbopack build. The related table and
accessibility run passed 15 browser tests with five platform skips across Chromium
and WebKit. A final readonly regression passed in both browsers after applying the
same editability guard to block mutation handles; it checks that block and table
controls disappear and a pending gesture cannot change the document.

The standalone menu regression covers selection/read-only changes without parent
rerenders. Additional tests cover retained actions after typing, moved tables,
newer widths/attributes, missing targets, stale transactions, destruction, editor
replacement, and cell-selection anchor changes. The anchor regression was observed
failing before its correction. The subagents did not run these broad checks.

Validation used Node 26.12.1 and pnpm 12.15.0. App build/browser checks used the
project-store override and disposable fixture values. Logs remain in
`.cache/openeditor-validation/`, including `audit-final-unit.log`,
`audit-related-browser-passed.log`, and `unification-results/audit-ci.log`.
