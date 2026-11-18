# Journl v4.3 review findings

CANDIDATE / NOT APPROVED. This package is ready for design review. It is not production acceptance.

## Delivered

All 15 primary renders are present, plus 11 cropped state proofs and four unchanged baseline copies. The gallery embeds the exact PNG bytes in Explore, Library, chat, marketing, materials, before/after, and state-proof sections. The manifest records all 30 canonical images, their viewports, actual dimensions, sources, and SHA256 values.

Landing captures use viewport 1440 × 1000 and produce 1440 × 3195 PNGs. Mobile uses viewport 390 × 844 and produces 390 × 3905 PNGs. These are full-page captures. Other primary dimensions match their requested viewports.

## Findings and repairs

- Removed the chosen sidebar's inset left stripe and persistent selected-state rim. Selection now uses a clean pastel pill, dark icon, semibold label, and `aria-current`. Keyboard focus retains its own ring.
- Row actions keep their slots, accessible button names, and tab order. Fine-pointer desktop actions reveal on row hover, focus-within, or menu-open. Coarse/no-hover actions remain visible.
- Removed the reserved dock row. Ask Journl floats inside the content panel. Added 112px inner scroll clearance and moved the desktop Open thread action beside the pill.
- Continued v4.2's four semantic pastels and Inter with cooler blue/slate foundations, edge highlights, visible glass, and opaque reading surfaces.
- Rebuilt the landing narrative around organizing and finding project, recipe, reference, and personal knowledge. Restored the original footer home link during source comparison.
- Increased contrast for small captions over the light blue ambient field. Corrected the mobile footer brand target to at least 44px.
- Captures wait for local font readiness. The app heading font was independently inspected through the browser's platform-font report, which identifies custom Inter glyphs.

## Recorded checks

| Check | Result |
| --- | --- |
| Scene script errors | None in the 15 primary renders |
| Horizontal page overflow at 390/1440 | None |
| Horizontal content-scroller overflow | None |
| Inter font readiness | Passed for all 15 primary scenes |
| Actual heading font | Custom Inter in all ten app scenes |
| Initial app text and named controls | Exact parity for all ten app scenes |
| Desktop navigation / main-panel bottoms | Both y=984 in the six desktop app scenes |
| Floating pill containment and center hit | Passed in all eight collapsed Explore/Library scenes |
| Chat conversation / composer | Separate, non-overlapping regions in both desktop modes |
| Balanced / expanded agent widths | 480px / 704px |
| Interaction assertions | 52 / 52 passed |
| Default selected-nav hover/focus | Neither hovered nor focus-visible |
| Mobile visible control targets, including below fold | All at least 44 × 44px in six mobile scenes |
| Desktop and mobile end-scroll | Final visual controls have visible keyboard focus, remain clear of pill, and pass center hit tests |
| Forced-colors surfaces | Opaque system-color surfaces and explicit selection |
| Opaque fallback class | Blur removed; solid navigation fill |
| Marketing public action paths | Exact link sequence matches the prior landing |
| Footer information | Preserved |

The interaction report covers both themes. Evidence crops show resting, hover, keyboard focus, menu-open, touch navigation, end-scroll, and forced colors. Each trigger has `aria-haspopup="menu"` and `aria-expanded`. Escape restores trigger focus. Menu-open state retains the trigger's visible row action.

## Composited contrast

The lowest sampled text contrast is **4.72:1**. The lowest sampled pastel-control contrast is **8.41:1**. No sampled text pair is below 4.5:1.

`composited-contrast.json` pairs computed text RGB with actual rendered PNG background pixels at three points along a text element's line-box edge. The points sit in the blank leading space above glyphs. This includes the result of alpha fills, ambient light, blur, and shadows. Large material containers are marked as reference diagnostics, because their highlighted edges have no text on them. They are not included in the text minimum.

Dominant rectangle colors are also retained for diagnosis. On a continuously varying gradient, a glyph's solid ink can be the most frequent exact RGB value. That is why a dominant-color-only estimate is not used as a text-background measurement. `rendered-checks.json` additionally records inset padding samples and background diagnostics.

These samples do not measure every pixel under every glyph. They do not certify antialiasing, all image regions, future content, all hover/focus states, arbitrary scroll positions, or full WCAG compliance. Small captions, muted glass labels, reading text, and pastel controls are included; the specimen's two modes are measured separately.

## Package integrity

`package-checks.json` records canonical PNG hashes, exact HTTP bytes, unchanged baseline originals, and image decoding/hash comparisons for both the original gallery and a byte-identical copied gallery served over HTTP. Every embedded image instance is checked, including repeated after-images in comparison sections. The temporary gallery copy is removed after the check.

## Explicit limits

- Chromium desktop and browser-emulated touch were checked. No physical phone, Safari, or Firefox acceptance was performed.
- The opaque fallback class and forced colors were exercised. A native operating-system reduced-transparency setting was not tested across platforms.
- No screen-reader session or full WCAG audit was performed. The W3C references inform the keyboard and focus design only.
- The scenes contain review-only conveniences. They do not implement backend behavior, persistence, actual AI generation, or complete product flows. The row menu retains the baseline's close-only scene content.
- Sign-in and invitation hrefs are preserved. No account access or live invitation flow was exercised. A local review server does not implement those production routes.
- Marketing folders and notes are realistic synthetic examples. The response is labeled illustrative. No future sharing, connectors, agent integrations, schedules, reminders, pricing, metrics, testimonials, or security promises are marketed.
- Web glass is not native Apple optics. No refraction or platform-optics claim is made.
- The review file embeds fonts and screenshots. Editable sources and supporting records require the rest of the folder. Some reproduction scripts intentionally refer to the existing Playwright installation or read-only baseline sources.
- Production code, prior reviews, package configuration, and installed dependencies were not changed.

No requested render is missing. Review status remains CANDIDATE / NOT APPROVED.
