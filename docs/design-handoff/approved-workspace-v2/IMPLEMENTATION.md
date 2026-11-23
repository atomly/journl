# Approved visual reference

Use APPROVAL.json and screen-state-index.json to identify the exact user-approved captures. The PNGs are the visual source of truth. Their original review watermark remains intact; approval is recorded separately. Do not regenerate goldens or edit images to make comparisons pass.

Use review/workspace.css and review/scenes.ts to understand visual decisions, not as a replacement application. Preserve existing editor, persistence, authentication, AI SDK, references, and data-safety behavior. The original complete handoff inventory still defines capabilities not covered by these representative views. This approval does not establish full-application parity.

For each owned state: use matching synthetic content, theme, viewport, and scroll; capture the real app; create side-by-side, alpha overlay and difference images; measure panel bounds, padding, type and hit areas; inspect hover/selected/focus combinations and rendered contrast manually. Keep functional checks separate. Explicitly record unimplemented regions and unavailable device checks. Do not hide owned defects with broad masks.

At 1440x1000 the reference has navigation 216px, center 760px, assistant 400px, viewport insets and gutters 16px. At 1920x1080 it has navigation 240px, center 1192px, assistant 424px. Both panels have equal top and bottom insets. The header belongs to the document column. See the approved behavior section for resize and adaptation, with independent panel preferences.

The existing shell's uncommitted alignment changes are an unvalidated starting point, not approval evidence. Final shell acceptance requires the new geometry, typography, material, hover/focus insets and contrast, not just moving the agent upward.
