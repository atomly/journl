# Journl — approved design handoff v 2

The full accepted application set now uses the approved **Shifted right** Gather logo. This supersedes the supplement-only v 1 handoff. Production implementation remains a separate task.

## Source of truth

- **application/screenshots/** contains all 1,830 regenerated canonical PNGs for 438 states, including all 422 baseline IDs. Current proposed views use the exact approved artwork in every existing branding placement: navigation, mobile sheets, authentication, marketing header/footer, and embedded dashboard imagery. A logo stays hidden where the accepted collapsed/mobile layout hides branding.
- **application/index.html** shows every family and a searchable state index. Each image maps to its route, surface, state, viewport, actions, dimensions and hash in screen-state-index.json and.csv. These reviewed layouts plus the approved logo integration are the implementation reference.
- **brand/assets/** and **application/assets/brand/** contain identical approved SVGs and raster icons. Use the supplied artwork directly. Do not redraw the mark or recreate the wordmark with a font.
- Historical current-app captures, archived direction evidence and the Before column in brand/review/comparison.png retain their original branding. They are evidence, not the current proposed UI. Earlier external review versions remain unchanged.
- Root approval.json records the separate application and logo approvals and this deterministic integration. The user has not separately approved a new layout revision: this update changes branding only.

## Implementation references

- application/specs/foundations.md: typography, spacing, color, material, sizing and component states.
- application/specs/approved-brand.md: exact artwork and placement rules.
- application/specs/behavior-and-menus.md: workflows, actions, validation, loading and errors.
- application/specs/responsive-and-implementation.md: responsive rules and details still images cannot express.
- application/feature-parity.md and.csv: existing capabilities mapped to exact images.
- application/coverage-matrix.json and specs/current-access-gaps.md: captured, inspected, inaccessible and not-applicable states.
- application/specs/brand-integration.json: complete image inventory, non-brand geometry/control comparison, pixel-difference checks and original-evidence hashes.
- application/specs/qa-summary.json: image integrity, all gallery image instances, local links and interaction checks.
- manifest.json: every packaged file hash, excluding the manifest itself.

Keep the exact PNGs as the visual reference. Rendering sources are review tools, not production components to copy blindly. Follow the repository's current AGENTS.md and README.md during any separately authorized implementation. Preserve BetterEditor's independence, identities, draft/history, selection, read-only enforcement and gesture cancellation.

## Verification and remaining limits

All 1,830 canonical images were regenerated. All 52 review pages were checked at desktop and mobile widths, with every embedded image decoded. Logo asset files match the selected After exports byte-for-byte. The original state inventory, raster dimensions, controls and non-brand layout remain unchanged. Pixel comparison records brand/dependent dashboard changes, small raster-rounding differences, and text raster differences. For the latter, separate checks confirm identical text, computed font/color/style and glyph-layout rectangles. It does not claim byte-identical non-brand pixels. Exact counts are in the verification JSON files.

The historical current-app ledger remains 43 captured,337 inspected,38 inaccessible and 4 not applicable. Authored designs do not close those runtime gaps. Chromium/emulated-touch checks do not certify Safari/Firefox, physical-device keyboard/IME, screen-reader behavior or complete WCAG conformance. The existing handoff documents retain the specific gaps and unresolved compatibility questions.
