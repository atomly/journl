# Consumer composition cleanup

BetterEditor supplies reusable engine behavior and React parts. Journl owns its
editor assembly in `apps/web/src/components/editor/document-editor-view.tsx`.

## Findings and changes

| Finding | Change |
| --- | --- |
| Library `DocumentEditor` selected the application's extensions and UI. | Move the composition into Journl and remove the library file and export. |
| Library toolbar and block actions selected menu items, ordering, and app services. | Move them into Journl. Keep independent toolbar, command, mark, and link controls. |
| Block, table, and context menus silently supplied application actions. | Require `renderMenu`; the library retains gestures, targeting, and focus behavior. |
| Slash menus silently chose the default item catalog. | Require an item source. Journl explicitly chooses the reusable catalog. |
| Reference views instantiated nested document editors. | Accept `renderEmbeddedContent`. Without a renderer, do not fetch expanded content. |
| Reference views chose action menus and a two-level embed limit. | Accept `renderActions` and `maxEmbedDepth`. Journl chooses its actions and limit. Cycle protection remains intrinsic. |
| Reference presentation also installed drop-cursor feedback. | Extract an independent engine extension. Journl explicitly installs it. |
| Link editing automatically added an application reference action. | Expose a child render function with selection restoration. Journl adds its mention action. |
| Editability depended on a persistence callback. | Default to editable independently of persistence. Journl explicitly applies its own read-only policy. |

The package exports leaf modules explicitly. Removed presets and private
implementation modules have no compatibility exports. Registry checks reject
preset files and imports from consumer application modules.

## Interaction corrections

Using the shared toolbar throughout Journl exposed focus and positioning defects.
Alt+F10 now focuses an already visible toolbar. Floating toolbars avoid selected
table cells and stay within the editor's horizontal bounds. Sticky toolbars do
not receive floating-layout middleware. Portalled reference menus carry the
editor ownership marker so they do not dismiss their parent toolbar.

## Verification

The copied-source registry installs into a separate consumer and compiles with
TypeScript. A minimal consumer passes standalone composition checks in Chromium
and mobile WebKit. These checks cover layout changes without engine replacement,
formatting, link editing, custom slash items, read-only behavior, and explicit reset.

The final local CI run passed frozen installation, dependency checks, lint,
workspace typechecks, registry checks, 445 unit/UI tests, 43 database tests,
109 browser tests, and the Turbopack production build. There were 21 configured
platform skips. Both browsers passed link-to-card conversion after the portal
ownership correction. The build logged auth configuration warnings in its
isolated fixture environment but exited successfully.

The final run used Node 26.12.1, pnpm 12.8.2, and a project-local virtual store.
The global-store default installs and typechecks, but Workflow/Turbopack cannot
transform dependency files in that external store. CI explicitly selects the
project layout. Browser fixtures wait for route readiness and popup closure.
The complete log is retained locally at
`.cache/openeditor-validation/unification-results/final-toolchain-ci.log`.

## Scope retained

The existing document and reference contracts remain, as agreed. This cleanup
does not replace their schemas or dependencies. Optional schema features,
transaction-mapped indexes, bounded pointer hit testing, and AI replacement
remain separate work.
