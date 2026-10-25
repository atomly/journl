# Legacy AI compatibility

Page, journal, and reference editor surfaces use `@acme/editor`. There is no
BlockNote frontend branch, editor-selection cookie, or comparison switch.

`@acme/document` owns validation, storage reconstruction, operations, and
compatibility fixtures. `@acme/tiptap` and `@acme/editor` do not depend on this
package.

This package remains only for the existing AI integration's editor types and
its installed-editor compatibility tests. The remaining application consumers
are active-editor/selection types in `use-journl-agent`, the old AI write,
apply/reject tools, and `/api/ai/blocknote`. Those are replaced by the Journl-owned
proposal and streaming work in #374 and #376. Full dependency removal is tracked
in #375. Do not add new consumers or use this package for application rendering.

Delete the remaining AI integration, this package, and `@blocknote/*` dependencies
when that replacement is ready. Keep the framework-independent document fixtures
and tests.
