# Journl review findings — approved logo integration

The application handoff and Shifted right logo were accepted by the user. Revision v6 integrates that artwork into every existing branding placement and regenerates the canonical PNGs. Historical approval evidence remains unchanged. See brand-integration.json and qa-summary.json for the current verification results. Every original non-brand control and region retains its geometry and identity. Raster comparisons separately record small edge rounding and text raster differences; exact text/font/color/style and text-rectangle checks passed for all 88 scenes with nontrivial text raster differences. Non-brand raster bytes are not claimed to be identical. This is a design handoff; production implementation remains unauthorized.

## Repairs made

- Replaced generic in-flow menu examples with bounded, anchored contextual popovers over populated routes. The triggering row/control remains visible while open.
- Editor selection, slash, link, color, table and block menus now preserve document layout behind the overlay. Mobile menus use a bounded bottom sheet. Long menus have internal-scroll captures with the same state ID.
- Recovery, move, delete, conversion, search, session revocation, reauthentication and intercepted-route states use their appropriate dialog layers. Actions remain reachable outside the body scroller. Ordinary routes and inline naming remain routes and inline fields.
- Corrected tablet expanded-agent navigation to a real 64px rail. Desktop navigation and assistant expansion remain independent.
- Corrected page/editor/reference breadcrumbs and selected page navigation. Auth copy uses the approved knowledge-first positioning and one clear form heading.
- Retained the natural-ratio canonical Library hero in both themes and mobile/desktop. Marketing uses the exact source PNG file.
- Enlarged checkbox-label and link touch areas. Corrected dark graph label contrast and adapted graph labels for mobile.

## Evidence and limits

All 422 baseline IDs and 16 added preservation states remain in the 438-state ledger. Canonical screenshots, mappings and semantic surface classifications distinguish routes, contextual overlays and supplemental reference plates. Supplemental plates do not replace the related contextual designs.

The original current-browser evidence remains 43 captured, 337 inspected, 38 inaccessible and four not applicable. This task does not upgrade those statuses. Real historical captures are preserved, and comparisons identify different fixtures rather than claiming identical data.

The final QA JSON files record actual per-image geometry/font/image checks, copied-gallery HTTP decoding/link checks, interaction checks, composited contrast samples and immutable-original hashes. The final run has no unresolved automated findings.

Chromium and emulated touch checks do not certify physical-device keyboard/IME, Safari/Firefox, screen readers or complete WCAG conformance. No production app build, database access, real account mutation, payment or live AI call was performed. New screenshots are authored design scenes, not evidence that current runtime gaps have been closed.

## Final check results

| Check | Actual result |
|---|---|
| Ledger | 438 states: all 422 baseline IDs plus 16 additions |
| Missing baseline mappings | 0 |
| Missing light/dark desktop/mobile combinations | 0 |
| Canonical PNGs | 1,830, including internal-scroll and content-end variants |
| State/image/region mappings | 1,850 |
| Per-image checks | All 1,830 checked for hashes, dimensions, loaded font, image availability, horizontal clipping, overlay bounds, declared headers and visible touch targets |
| Gallery checks | Root plus 51 linked gallery pages, at both 1440px and 390px: 104 page/viewport runs |
| Image decoding on copied package | 3,918 embedded image instances decoded over HTTP |
| Local links on copied package | 3,203 resolved, including state anchors and rendering-source links |
| Interaction checks | 27 passed, 0 failed |
| Approved original bundle | All 96 files unchanged against the original hash record |
| Current live-app captures added | 0 |

The interaction checks cover menu contents, bounds, Escape/focus return, internal menu scrolling, row-action visibility, touch names/targets, final-action clearance, hero ratio/hash identity, panel widths, draft preservation through expansion/resizing, resize limits, opaque fallback, reduced motion and forced colors. Actual custom Inter glyph use was checked through Chromium's platform-font report in 12 theme/surface cases. Font readiness was recorded for every canonical render.

The lowest active-text composited sample was **4.68:1**. Samples use three blank-leading pixels from actual PNGs paired with computed foreground RGB. Inert background text under a modal scrim is excluded from active-text measurements. These samples do not certify every glyph, image, scroll position or future content.

## Visual inspection

Visual inspection covered real screenshots from all 12 families, including contextual folder/page menus, initial and end-of-scroll mobile block choices, recovery and conversion dialogs, intercepted billing, authentication, account/security, search, reference previews, graph layouts, expanded assistant/tablet rail, and the marketing hero. Flagged defects were repaired and affected images regenerated. Automated structural and semantic checks cover every canonical image; this is not an exhaustive human review of every pixel.

## Remaining constraints

The 38 historically inaccessible current-app states remain inaccessible in the current evidence ledger. The 337 inspected states do not become captured because the proposed scene was rendered. See `current-access-gaps.md` for the exact inaccessible IDs and `coverage-matrix.json` for every state's status.

The accepted editor compatibility inventory still exceeds some current configured BetterEditor controls. Reference slash and AI review preservation illustrations are identified as compatibility proposals, not proof that the current production adapter implements them. Current direct block/table deletion is distinguished from the proposed confirmation guards. Supplemental component plates are paired with contextual companion states in `surface-classification.json`.

No production implementation, current app/browser acceptance, real-device keyboard/IME check, Safari/Firefox check, screen-reader session or full WCAG audit is claimed. New expanded views and corrected marketing remain pending review. No requested visual mapping or automated package check remains unresolved.
