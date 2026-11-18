# UI/UX refactor implementation guide

## Objective and product context

Implement the approved Journl design across the complete screen/state inventory. Read the repository's current AGENTS.md and README.md first. Inspect the current code before editing; source pointers in the index are navigation aids and may need updating as the application evolves.

Journl organizes useful knowledge: projects, random notes, recipes, references and anything else a user wants to keep. Notes and blocks support that goal. Marketing should emphasize organizing and finding knowledge, not writing as the primary purpose of the product.

Future connectors, agent ingestion, public/invited pages, schedules and reminders describe product direction. They are not instructions to add features during this refactor.

## Approved design decisions

- Use the specified blue-tinted canvas and readable foreground surfaces in both themes. Make the floating glass treatment visible while keeping text and controls clear. Follow the opaque, reduced-transparency, reduced-motion and forced-colors fallbacks.
- Use balanced vibrant pastel accents for their specified semantic roles. Avoid tinting every surface or control with one accent color.
- Use the supplied sans-serif type system and exact logo artwork. Do not substitute a serif wordmark, redraw the mark or change its block positions, gaps, corners or colors.
- Preserve floating navigation and assistant panels, with the approved collapsible/resizable desktop behavior. The assistant needs enough usable conversation space.
- Collapsing the assistant leaves a floating bottom-right Ask Journl button over the content. It does not create a reserved bottom row or shorten the main surface. The navigation and main surface retain their approved alignment. Do not use a vertical-text collapsed assistant rail.
- Preserve the standard chat message hierarchy and composer layout shown in the views. Panel collapse/resize must retain the conversation, draft, relevant selection and scroll position.
- Headers are route-specific. Journal Entries/Timeline controls belong to Journal states, not every route. Preserve the route identity and relevant actions shown in each screen.
- Avoid duplicate branding. Do not introduce a separate Focus writing mode that duplicates panel collapse.
- Row overflow actions appear on hover and keyboard focus where appropriate, stay visible while their menu is open, and remain discoverable on touch. Do not make actions hover-only for keyboard or touch users.
- Marketing uses the real dashboard design at the correct screen aspect ratio. Preserve the approved content, crop/fit rules and responsive composition.

## Refactoring contract

Preserve existing capabilities, stored information, available actions and data safety. Follow the approved behavior specifications for deliberate UI/UX changes. Do not remove functionality or invent a simpler replacement to make screenshot matching easier.

Implement real route, data and interaction behavior using the current application. Keep authentication/provider conditions, validation, save states, drafts/history, undo, stored identities, selection, references, read-only enforcement and cancellation semantics intact. Do not replace working behavior with static fixtures.

Keep reusable primitives in @acme/ui and Journl compositions in the application. Keep BetterEditor independent of Journl routes, persistence, styling and app-specific behavior. Follow the current repository's package boundaries. Compose chat with Base UI AI Elements and native AI SDK state; keep application chat behavior out of shared UI primitives.

Read full relevant state groups before changing a component. Account for portal/overlay placement, clipping, z-index, scrolling, focus containment/restoration, dismiss behavior, disabled/pending/error states and accessibility. Use the canonical images and CSS reference to understand geometry. Implement interactions with the current application components and state.

Resolve routine implementation choices independently. Raise an essential access blocker or a decision that would remove a core capability or change data/privacy policy. If the specifications and canonical image appear inconsistent, identify the exact state/image and resolve the conflict rather than silently approximating it.

## Implementation tracking

Use the full screen/state index to maintain explicit mappings from approved images to implemented routes, components, states and checks. Include all viewport/theme combinations and scroll variants relevant to each component. Record unresolved states directly; do not mark a state complete because a similarly named route exists.

Work in reviewable slices. Establish shared foundations and the shell, then implement the relevant route/state groups while retaining working behavior. Carry the same visual system through secondary surfaces. Do not leave menus, dialogs, forms or error states on a different style system.

The gallery search is a browsing aid. Use the JSON/CSV index and feature-parity mapping as the complete inventory. Repeated image paths can represent indexed regions of a shared screen; do not invent a new screen for each mapping. Check the surfaceKind, componentOnly, region and variant fields.

## Acceptance criteria

- Compare the actual implementation directly with the supplied canonical PNG at the matching viewport, theme, content and UI state. Match spacing, sizing, hierarchy, density, material, panel geometry and controls, not just colors.
- Validate real functionality as well as appearance. Include persistence, save/undo, assistant send/stop and draft handling, navigation returns, conditional provider/billing states and destructive-action recovery.
- Test keyboard navigation, focus restoration, touch access, resizing/collapse, mobile sheets, safe areas and keyboard/IME behavior. Validate supported browsers and screen-reader behavior as appropriate.
- Use synthetic data. Do not change or delete personal data to reach a test state. System-owned interfaces listed in boundaries.json are behavioral integration boundaries, not screens to restyle.
- Run relevant repository checks and existing Playwright tests under the current AGENTS.md instructions. A static image, source inspection or unit test does not establish browser acceptance.
- Report exact visual comparisons, tested states, failures, skips and remaining gaps in each implementation PR. Do not claim full coverage while indexed states remain unresolved.
- Do not deploy, merge PRs or publish artifacts without separate authorization.
