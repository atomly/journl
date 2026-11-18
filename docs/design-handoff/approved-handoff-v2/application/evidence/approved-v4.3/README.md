# Journl v4.3 — CANDIDATE / NOT APPROVED

Open `index.html` for the rendered review. It embeds the exact PNG bytes in every visual section. It also embeds Inter, so the review remains viewable when the HTML file is copied by itself. Keep the whole folder for editable scene links, specifications, original PNG files, and download records.

The PNGs in `screenshots/` are the source of truth. This is a design review package, not a production patch or an interactive app deliverable. All changes are inside `review-v4-3/`. Production and previous reviews were read only.

## Contents

- 15 primary PNGs: Explore × 4, Library × 4, balanced desktop chat × 2, full landing × 4, and one two-mode material specimen.
- 11 cropped state proofs: navigation and Library rest/hover/keyboard/menu-open, touch navigation, end-scroll overlay clearance, and forced colors.
- Four exact v4.2 baseline PNGs for matching comparisons. Original SHA256 values are retained.
- `manifest.json`: route, surface, state, theme, Inter, viewport, actual PNG dimensions, source scene, and SHA256 for all 30 PNGs.
- `sources/`: editable HTML, CSS, scene-only interactions, and the render/check scripts.
- `assets/fonts/`: local Inter variable font, source metadata, and OFL license.
- `specs/design-spec.md`: colors, materials, layout, menus, overlays, and accessibility fallbacks.
- `specs/review-findings.md`: checks, findings, repairs, and explicit limits.

## Capture sizes

| Surface | Capture viewport | Actual PNG |
| --- | --- | --- |
| Desktop Explore, Library, chat | 1440 × 1000 | 1440 × 1000 |
| Mobile Explore and Library | 390 × 844 | 390 × 844 |
| Desktop landing, light and dark | 1440 × 1000 | 1440 × 3195 |
| Mobile landing, light and dark | 390 × 844 | 390 × 3905 |
| Two-mode specimen | 1440 × 1000 | 1440 × 1000 |

Proof dimensions and crop coordinates are recorded individually in the manifest. These are actual captures at device scale 1, not resized exports.

## Editing and reproducing

The HTML sources reference only local styles, fonts, and scene interactions. App sources preserve v4.2 content and controls. Marketing uses clearly labeled synthetic organizing examples. Its public actions retain `/auth/sign-in`, `/invite`, and the footer home link `/`.

From this folder, `node sources/serve.ts` starts the review server on a random available port from 49152–65535, bound to `0.0.0.0`. It writes the selected port to `specs/server.json`. Open the server's `/` page using your host's reachable IP. No dependencies or package configuration are added.

`node sources/render.ts` uses the existing Playwright installation requested in the brief. Optional name prefixes restrict regeneration, for example `node sources/render.ts landing`. The render script needs the existing Journl development environment; it does not install it. `sources/marketing-build.ts` regenerates the marketing and specimen sources. App HTML is edited directly.

After deliberate scene edits, render the affected images, run the relevant check scripts, and regenerate the gallery with `node sources/package.ts`. The package script needs the original read-only v4.2 folder to refresh the four exact baseline copies. Normal viewing and scene editing do not depend on that folder.

## Limits

Browser checks use Chromium and emulated touch. They do not establish physical-device behavior, Safari parity, screen-reader acceptance, or full WCAG conformance. Contrast uses actual composited PNG samples, not every pixel or arbitrary future content. The review does not implement backend behavior, live AI, persistence, or production row-menu operations. It makes no native Apple optics claim.
