# Approved Journl design handoff

The user accepted the full application design and the **Shifted right** Gather logo. The complete handoff integrates that exact logo into every existing brand placement. This PR records the design reference; it does not implement the redesign or authorize production changes.

## Complete source of truth — checked into Git

**Use [approved-handoff-v2/](approved-handoff-v2/), which is committed in full. No release download, external design service or LAN server is required.** The smaller specifications and screenshots beside this README are convenience copies; they do not replace the complete package.

Start with [the complete handoff README](approved-handoff-v2/README.md) and [approval record](approved-handoff-v2/approval.json). The package contains **438 state IDs and 1,830 canonical PNGs**, both themes, mobile/desktop layouts, selected tablet layouts, secondary surfaces, feature-parity mappings, all rendering sources, verification records and historical evidence. Every original baseline state has a mapping.

- [Complete review entry](approved-handoff-v2/index.html) and [all application views](approved-handoff-v2/application/index.html). Serve this folder over HTTP to use the searchable gallery; every image is stored in the repository.
- [Canonical screenshots](approved-handoff-v2/application/screenshots/): the exact approved visual references, not thumbnails or newly recreated approximations.
- [Screen/state JSON index](approved-handoff-v2/application/screen-state-index.json) and [CSV index](approved-handoff-v2/application/screen-state-index.csv): route, surface, state, viewport, variant, actions, image region and hash. Use these to find the correct image for each implementation state.
- [Feature parity](approved-handoff-v2/application/feature-parity.md) and [CSV mappings](approved-handoff-v2/application/feature-parity.csv).
- [Full specifications](approved-handoff-v2/application/specs/) and [editable rendering sources](approved-handoff-v2/application/sources/). Sources explain composition and states; implement within the current app architecture rather than copying the review renderer as production code.
- [Exact approved brand assets](approved-handoff-v2/brand/assets/) and [package file manifest](approved-handoff-v2/manifest.json).

The current proposed UI is under `application/screenshots/`. Files under `application/evidence/`, earlier direction captures, and Before columns in logo boards are historical evidence. Do not use those as competing current designs. A small representative screenshot subset is not a complete implementation brief.

Read the full state inventory before planning implementation. Inspect the actual PNG for every route, secondary surface and meaningful state being implemented, at its specified viewport and theme. Maintain explicit image-to-implementation mappings and record any uncovered states. Do not infer visual completion from matching colors, implementing a route, or passing unit tests. Preserve the detailed spacing, hierarchy, controls, panel behavior and responsive layouts shown in the canonical images and specified in the behavior documents.

The draft release and `archive.sha256` remain historical distribution references. They are optional now; the complete source of truth is available directly in this checkout.

## Convenience references

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
