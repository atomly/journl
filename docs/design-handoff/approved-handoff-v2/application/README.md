# Journl · Full application review v6 — approved logo

Open `index.html` through a static HTTP server. The entry links every family gallery and contains a searchable route/surface/state/theme/viewport index. Every family section shows actual PNGs. Images and fonts use portable relative paths.

The full application set and the Shifted right Gather logo were accepted separately by the user. This revision integrates the exact approved SVG artwork into every existing branding placement and regenerates all 1,830 canonical images, including the dashboard embedded in the marketing hero. It changes branding only. Historical current-app captures and archived review evidence retain their original bytes. See `specs/brand-integration.json` for verification and root handoff approval.json for the original acceptance statements. Production implementation remains unauthorized.

The finished set contains **438 state IDs, 1,830 canonical PNGs and 51 family/evidence galleries**, plus this root index. All 422 baseline IDs have explicit mappings. The final QA run has no unresolved automated findings.

## Contents

- `screenshots/`: canonical new PNGs, grouped by family. Full-page raster sizes and viewport sizes are recorded separately.
- `galleries/`: partitioned image galleries, original approval evidence, and real historical current-app comparisons.
- `screen-state-index.json` and `.csv`: routes, state IDs, exact regions, themes, viewports, dimensions, hashes, sources, fixtures, actions and provenance.
- `coverage-matrix.json`: all 422 baseline IDs plus added preservation states. Current browser evidence remains separate from proposed designed/rendered coverage.
- `feature-parity.md` and `.csv`: exact visual mappings and implementation pointers. Full behavior is in `specs/behavior-and-menus.md`.
- `specs/foundations.md`: semantic tokens, type, materials, controls and accessibility fallbacks.
- `specs/responsive-and-implementation.md`: breakpoints, panel sizes, preservation semantics, source paths and hero contract.
- `specs/hero-source-map.json`: exact marketing-to-dashboard paths, hashes and natural ratios.
- `specs/review-findings.md` and QA JSON files: actual checks, repairs, skips and remaining limitations.
- `evidence/approved-v4.3/`: complete immutable original bundle, including its original candidate labels. Later approval is recorded separately rather than rewriting history.
- `evidence/current-captures/`: real historical application captures, preserved without repainting. Comparisons identify different fixtures.
- `evidence/current-source-index.json`: read-only current-source hashes and line evidence. Inspection is not current browser coverage.
- `sources/`: exact editable rendering source, scene data and reproduction tools.
- `assets/fonts/`: the actual local Inter variable font, original source metadata and OFL license.

## View and reproduce

Use the existing mise runtime. From this folder, `mise exec -- node sources/serve.ts` starts the static server on a random available port from 49152–65535, bound to `0.0.0.0`. The chosen port is printed and stored in `specs/server.json`. Open `http://<your-host-IP>:<port>/`. A successful local request does not establish reachability from another device; remote/container hosts may need port forwarding.

`mise exec -- node sources/render.ts` renders the entire set using the existing Playwright installation resolved from Journl's web package. No dependency or configuration install is needed. Optional state IDs restrict a regeneration, for example `mise exec -- node sources/render.ts all-pages marketing-full`. Render Library before marketing because marketing embeds the exact canonical Library PNG. The complete renderer already orders that dependency.

`mise exec -- node sources/package.ts` rebuilds mappings and galleries from actual render records. `mise exec -- node sources/qa.ts` checks the scenes and copied-package gallery over HTTP. These tools do not start, rebuild or mutate the production application or its database.

`scene.ts` is the JavaScript-compatible TypeScript source. `scene.js` is its byte-identical browser output. `contextual.ts` composes the contextual menus/dialogs and route identity; `contextual.js` is its byte-identical browser output. After editing either source, copy it to its matching `.js` file before rendering. `scene-data.js` is generated data, backed by `specs/states.json`. All final rendering inputs are local. `prepare.ts`, `build.ts` and `supplement.ts` record original ingestion and normalization; re-running ingestion requires the original read-only references and is not necessary for ordinary reproduction.

## Boundaries

Synthetic fixtures illustrate projects, notes, recipes, references, account states and AI proposals. No real account was mutated. No personal writing or production database was used. The review does not implement backend persistence, live AI, authentication, billing or full app workflows.

Historical current coverage remains 43 captured states, 337 inspected, 38 inaccessible and four not applicable. New design-scene captures do not close current-app gaps. Real-device keyboard/IME, Safari/Firefox, screen readers and complete accessibility acceptance remain outside this check. The findings file records any narrower unresolved visual or package gaps.

The sibling `full-review-v5.zip` contains this exact folder with one top-level `full-review-v5/` entry. No nested archive or temporary copied package is included. `specs/file-integrity.json` records all delivered file hashes except its own self-reference.
