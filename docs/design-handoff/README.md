# Approved Journl design handoff

The user accepted the full application design and the **Shifted right** Gather logo. The complete handoff integrates that exact logo into every existing brand placement. This PR records the design reference; it does not implement the redesign or authorize production changes.

## Complete source of truth

The exact package contains **438 states, 1,830 canonical PNGs**, both themes, mobile/desktop layouts, selected tablet layouts, secondary surfaces, feature-parity mappings, editable rendering sources, and verification records. Every original baseline state has a mapping.

The archive is attached to the **unpublished draft release** tagged `journl-design-handoff-v2` in `atomly/journl` ([artifact storage](https://github.com/atomly/journl/releases/tag/untagged-0ba611aeba6e3d7fc3a9)). Maintainer authentication is required. Historical captures remain in the authenticated archive; they are not copied into this public PR. Do not publish the release as part of implementation.

From the repository root, retrieve and verify it with:

```bash
mkdir -p /tmp/journl-approved-design
gh release download journl-design-handoff-v2 --repo atomly/journl --pattern journl-approved-handoff-v2.zip --dir /tmp/journl-approved-design
handoff_checksum="$PWD/docs/design-handoff/archive.sha256"
(cd /tmp/journl-approved-design && sha256sum --check "$handoff_checksum")
unzip /tmp/journl-approved-design/journl-approved-handoff-v2.zip -d /tmp/journl-approved-design
```

If the draft release is inaccessible, ask a maintainer to provide the same checksum-verified archive. Do not substitute a new interpretation or incomplete screenshot subset.

Start with `approved-handoff-v2/README.md` and `approval.json`. Open `application/index.html` through a static HTTP server to browse all views. `application/screen-state-index.json` and `.csv` map exact images to routes, surfaces, states, viewports, actions and hashes. `application/feature-parity.md` and `.csv` map existing capabilities. `manifest.json` lists packaged file hashes. The reviewed PNGs and approved logo files are the visual source of truth.

## In this PR

- [Foundations](foundations.md): typography, spacing, colors, materials and component sizing.
- [Behavior and menus](behavior-and-menus.md): interactions, available actions, validation, loading and errors.
- [Responsive and implementation guide](responsive-and-implementation.md).
- [Brand placement](approved-brand.md) and [exact approved assets](brand/).
- [Current application coverage gaps](current-access-gaps.md).
- [Light Library](screenshots/library-light.png), [dark Library](screenshots/library-dark.png), [desktop marketing](screenshots/marketing-light.png), and [mobile marketing](screenshots/marketing-mobile.png): exact canonical files copied from the complete archive, not recreations.

## Implementation agent brief

Use the complete checksum-verified handoff. Read the repository's current AGENTS.md and README.md before implementation and inspect the current application source; the design audit is historical. Implement in reviewable slices, starting with shared foundations and the application shell. Preserve capabilities, stored content/identities, draft/history, selection, accessibility, read-only enforcement and gesture cancellation. Keep BetterEditor independent of Journl-specific styling, persistence and behavior. Keep reusable primitives in @acme/ui and app composition in Journl.

Use the approved screenshots directly for visual comparisons with matching state/content and viewport. Preserve the floating, collapsible/resizable navigation and assistant surfaces, route-specific headers, pastel accents, blue glass surfaces, sans-serif typography and exact logo. Marketing describes organization and useful knowledge, not writing as the primary goal. Future connectors, public/invited pages, schedules and reminders describe product direction; they are not authorization to add features in this implementation.

Resolve routine implementation choices independently. Escalate a decision that would remove a core capability or change data/privacy policy. Do not treat source inspection as browser acceptance. Run the repository's relevant checks and report actual failures/skips. Publishing or deploying requires separate authorization.

## Verification and limits

The design package passed integrity checks for all 1,830 images, 52 review pages at desktop and mobile widths, 3,918 embedded image instances, 3,203 local links and 27 design interaction checks. The brand integration preserves control geometry and identity. Verification records distinguish branding changes, minor raster rounding and text rasterization differences; they do not claim byte-identical non-brand pixels.

These are authored design checks, not production-app acceptance. The historical current-app ledger remains 43 captured, 337 inspected, 38 inaccessible and four not applicable. Chromium/emulated-touch checks do not certify Safari/Firefox, physical keyboard/IME, screen readers or complete WCAG conformance. Known gaps must remain visible during implementation.
