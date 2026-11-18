# Journl — approved UI/UX implementation handoff

Start with [the visual gallery](index.html). This handoff contains the final approved application design: **438 states and 1,830 canonical PNGs**. It is the implementation reference for the UI/UX refactor. All files are in the repository. No external archive, design service or network access is needed to retrieve the designs.

## Read and inspect

1. [Implementation guide](specs/implementation-guide.md): product context, approved decisions, refactoring rules and acceptance criteria.
2. [Visual foundations](specs/foundations.md): typography, colors, materials, spacing, sizing and component states.
3. [Behavior and menus](specs/behavior-and-menus.md): controls, interactions, validation, loading and errors.
4. [Responsive and implementation details](specs/responsive-and-implementation.md): layout changes, panel behavior, keyboard, focus and accessibility.
5. [Brand specification](specs/approved-brand.md) and [exact assets](assets/brand/): use the supplied artwork directly.
6. [Screen/state index](screen-state-index.json), [CSV index](screen-state-index.csv) and [feature-parity mapping](feature-parity.csv): locate each route, surface, state, viewport, image and available action.
7. [System/external boundaries](specs/boundaries.json): interfaces owned by the browser, operating system or external provider.

## Use the views as the implementation reference

[Browse by application family](index.html), or use the search and theme filters to find a state. The gallery embeds the actual full-resolution PNGs. Each state identifies its route, actions, conditions, viewports and related current-source paths. Open an image to inspect it at full resolution.

For each implementation slice, inspect every relevant route, modal, drawer, menu, popover and meaningful state. Include both themes, responsive layouts, loading, errors, empty/populated states, selected/expanded states, search/filter results and validation. A representative screenshot is not sufficient to implement a whole route.

The index distinguishes contextual screens from supplemental component reference plates. Component plates explain component states; they are not extra application routes. Scroll variants show different portions of the same long surface. The index records viewport size separately from full-page image dimensions and includes regions for shared images.

The exact PNGs in [views/](views/) govern appearance. Written specifications govern behavior that a still image cannot show. [reference/visual-system.css](reference/visual-system.css) contains the final shared visual rules from the design compositions. It is a styling reference, not production architecture to copy. Reuse the current application's real state, data and actions. Do not ship synthetic fixture data or placeholder interactions from the design renderer.

## Package contents

- views/: all 1,830 current approved PNGs grouped by application family.
- galleries/: screen/state galleries with explicit viewport, theme and variant labels.
- specs/: final visual, behavioral, responsive and implementation specifications.
- assets/: exact logo artwork, icon exports and licensed reference font.
- reference/: CSS rules supporting the final visual system.
- screen-state-index.json/.csv and feature-parity.csv: complete implementation mappings.
- manifest.json: file hashes for integrity checks.
