# Approved Gather logo — Shifted right

The user selected the After version in logo-review-v7: “Shifted right is perfect.” All files in assets/ are exact copies of that revision, without another redraw.

## Asset mapping

- lockup-light.svg / lockup-dark.svg: complete symbol and Journl wordmark for the respective themes. Remove the former wordmark plus peach j. badge when using the lockup; do not display both brands.
- mark-light.svg / mark-dark.svg: standalone symbol for compact brand positions, the collapsed rail and favicon/app-icon use.
- wordmark-light.svg / wordmark-dark.svg: wordmark-only variant where the symbol is intentionally separate.
- *-mono-ink.svg / *-mono-white.svg: exact monochrome treatments.
- icon-{light,dark,mono-ink,mono-white}-{16,24,32,48}.png: transparent, exact-size raster exports.

The mark's viewBox is 64 by64. Upper-left block: x8,y0,width24,height20. Upper-right: x36,y0,width24,height38. Its gap to the base remains4 units. Only the upper-left block's horizontal position changed from the prior top-aligned version. Preserve the paths, corners, colors, transparency and gaps. Scale uniformly; do not fit-to-visible-bounds, stretch, add a stroke, round corners further or recreate the letter with a font.

The lockup preserves the original outlined Inter wordmark and its origin/spacing. Main SVGs are self-contained outlined paths and need no installed font. The Inter OFL license is included here; the supplied source font and its provenance are in application/assets/fonts/.

The integrated application PNGs and application/specs/approved-brand.md govern placement. Hidden compact navigation remains hidden; do not add a logo that moves existing controls. Where a standalone symbol is needed, use the supplied32px export. The earlier context proof is preserved as logo review evidence. The actual16px samples and exported icons show the antialiased small-size result. Keep at least8px outer clearance around a32px symbol where space permits; preserve the original image viewBox and baseline.

For a standalone brand image/link, expose the accessible name Journl. If a decorative symbol sits beside an independently named wordmark/link, hide the redundant symbol from assistive technology. Do not rename or replace the textual Ask Journl assistant controls with the logo.

review/comparison.png contains both historical Before and approved After columns; only After is selected. review/context.png shows the exact approved assets in the existing sidebar, rail and headers. Root approval.json contains hashes and provenance. Earlier logo explorations and vertical-placement alternatives are not selected.
