# Interaction, responsive and state ownership

READY FOR FINAL USER REVIEW · NOT USER-APPROVED. These are implementation requirements for a static design candidate. They are not evidence that runtime interactions passed.

## Context bar

One bar owns the navigation toggle, current route/document, Save details and global search. It replaces v008's ornamental strip and duplicate note header. Journal shows the current Entries/Timeline mode plus date/history. Dated entries show their date. Pages show Library / folder / page context. Explore shows thread or source context. Other routes expose today's Journal. At narrow widths, Route actions contains Entries, Timeline, history/date and return-to-Journal instead of silently removing those controls. The corresponding menu is drawn in `narrow-route-actions`.

Search opens from this bar or Cmd/Ctrl+K. Preserve the current 150ms debounce and request only after more than two characters. Results retain Journal/Page type, highlighted title/passage, dates and destination. In an active editor link context, its Cmd/Ctrl+K command takes precedence over global search. Closing search restores the originating focus/selection. No separate sidebar search launch duplicates the bar.

Current mobile header source reveals the bar at the top within 12px, hides after a 24px downward gesture and reveals after a 72px upward gesture. Ignore elastic overscroll; keyboard-visible focus forces the header visible. Retain those source-confirmed rules as the starting behavior. Observe the main content scroller, not the agent's independent scroller. Reserve matching top space; never move focus as the bar hides. Reduced motion removes the slide. Active save failures/offline drafts and recovery notices remain outside this hideable chrome and reachable at every scroll position.

Billing moves to Account & plan. Free accounts can Upgrade to the configured plan. Cancelling subscriptions can Continue Membership / Stay Subscribed. Active non-cancelling subscriptions get no promotional header action. Keep async disabled states, checkout/portal failures and return routing. Live quota failures stay in chat, not hidden behind the account menu.

## Desktop, tablet and mobile workspace

Desktop outer inset is 16px, inter-surface gap 12px, rounded surface radius 14px. Navigation, note and agent are independent regions. Balanced navigation is 208px and agent 480px. Expanded agent is 704px with a 56px navigation rail. Preserve at least a 560px editor surface before choosing an overlay. Suggested navigation range is 192–280px; agent range 400px to a dynamic cap no greater than 736px. These are proposed values. Current source instead defaults/mins to 14rem navigation and 20rem chat, with 50rem maxima; existing resizing is not absent.

Each visible edge has a generous pointer target, not just a hairline. Capture the pointer during drag. Escape cancels and restores starting width/open state. A click without drag toggles where current behavior supports it. The existing implementation collapses below 80% of minimum; preserve that expectation with clear preview feedback, while retaining the preceding open width. Focusable separators announce name/current/min/max. Left/Right adjusts 16px, Shift+arrow 32px, Home/End bounds, Escape cancels. Explicit collapse/restore controls remain available. Do not intercept text-selection gestures.

Collapsing the agent removes its column entirely. One bottom-right Ask Journl pill restores the preceding width, mode, sources, conversation and draft. There is no vertical agent rail or Focus writing button. Preserve the existing new-assistant-message dot and accessible hint on the floating pill while chat is closed. It is not a numeric notification count. Closing returns focus to that pill. Reserve bottom clearance for the pill and recovery notice so neither covers text, selection or errors. The navigation rail remains useful for Journal, Explore, Library and Account, with accessible names and focus tooltips.

At about 1200px or whenever minimum regions cannot fit, use an agent overlay rather than squeeze writing. The 834×1112 tablet scenes show this transition. On 390px mobile, navigation uses its own sheet; chat/context uses one full-height sheet. Background content is inert while a modal sheet is open. Tabs and close control stay outside the independently scrolling content. Chat composer remains outside conversation scroll. Native keyboard behavior uses visual viewport height and safe-area insets, shrinks conversation first and reveals the focused field. Close/back restores note scroll and focus. IME composition cannot accidentally send. OS keyboard and screen-reader acceptance remain untested.

## Data and state ownership

Document/block identities remain in the existing document contract. Moving/converting retains IDs; duplication creates new IDs. Conversion flushes/version-checks the draft before transfer, retains the Journal reference and invalidates existing affected queries. No second rich-content schema is introduced by this review. Synthetic fixture display data and scene definitions are not application persistence proposals.

Title and body share the existing versioned save queue. The existing draft/session providers own pending changes across navigation and row unmounts. They are owner-isolated. Preserve native caret/selection and text scroll anchors through reflow, not only old pixel offsets. Selection highlighting must be a non-mutating presentation decoration. Unknown stored content never becomes an empty writable document.

Context previews use the existing document identity and read-only presentation. They do not create a parallel save queue. Open page deliberately changes editing destination. Preserve each mode's scroll, linked context, conversation, explicit source choices and chat draft when switching tabs or resizing. Keep these transient view states in the existing session/runtime model. Existing layout preferences may hold width/open state; do not create a new durable content or preference schema. Do not persist ephemeral viewport clamps over a person's chosen width.

## Chat and source safety

Ask Journl is the assistant title/action; Journl remains the brand. User turns use right bubbles and assistant turns unboxed paragraphs. Roles remain accessible labels. Announce incremental output without rereading history after resize or theme changes. Copy/Retry, user Edit/Cancel/Send and branch navigation are shown or mapped to focus/hover actions. Do not conceal them from keyboard users. Sending is explicit; nonempty draft enables Send, streaming replaces it with Stop. Stop retains partial output. Blank/quota-disabled input cannot send. Thinking/Instant retains current choices; source inspection, selected-text removal and source overflow remain visible/discoverable.

The existing tool status labels are drawn from the current action map, including note/search/write actions. They are status examples, not evidence a tool ran or wrote user content. No new agent tool is proposed. Tool/reasoning failure keeps the draft and source state. Quota notices distinguish Free upgrade-or-wait from Pro wait, with reset information. Account & plan retains usage access. Do not add ratings, voice, sharing, model picker or generic file upload. Avatar upload remains its separate existing account capability.

## Explore, references and Library

Explore starts with source passages. In the focus fixture, three journal entries explicitly reference Space before plans. The thread has four notes and no external sources. The attention fixture separately includes one synthetic external source, a field-guide passage saved in On paying attention. Internal page links are not external sources. Where an algorithmic cluster has no authored-link explanation, show the contributing notes and say an explanation is unavailable. No invented confidence or causal explanation.

Thread rename, successor navigation, source contexts, note preview, graph traversal, incoming/outgoing links and independent notes/sources/connections pagination remain. Failed next-page loads preserve loaded items. Graph stays secondary and keeps pan/zoom/fit, selection and original-note access. Mobile graph content is a horizontal viewport with readable node labels, not a squeezed desktop canvas. It has a list alternative.

Library All pages is a proposed index destination using existing note/page data. It is not a new storage system. Folders retain separate expand and open actions, nested paths, row menus, create, rename, move, reorder and delete. Invalid descendant drops are blocked; Escape/touch cancellation restores order. Pending operations prevent duplicate submissions; errors restore the prior tree. Destructive confirmations name the item and consequence. Full action lists are mapped in the component atlases, not silently omitted behind an ellipsis.

## Editor and recovery

Contextual controls retain all installed block choices and marks, alignment, document colors, indentation, block commands, link/mention/reference modes, code language and table commands. Stored content colors are independent of chrome theme. Slash suggestions honor IME, filtering, async errors and live selection. Read-only removes mutation paths while keeping safe selection/copy. Table actions depend on cell/axis selection and capability; merge/split and header/resize/reorder cancellation preserve structure. Legacy BlockNote upload tools are not reintroduced.

Save status covers autosave/saved/saving/offline/failures/kept copies. Recovery preserves exact rich JSON, references and formatting. Keep both precedes loading newer saved content; do not silently overwrite a conflict. Retained copies are in this tab only, with read-only View/Hide, download failure handling and remove confirmation. Downloads are backups; import is unsupported. Persistent notices survive navigation. Native beforeunload wording is browser-owned and documented separately, not fabricated as Journl UI.

## Authentication, account and billing boundaries

Current provider wiring configures Google/GitHub, WebP avatar conversion at 256px and the theme plugin. Password sign-in requires a server flag. Public invite signup is provider-only. Current AuthView permits only sign-in, sign-up and sign-out and redirects other auth paths, despite retained forgot/reset/verification components. Their retained components are illustrated conditionally only. Do not enable those routes or change public authentication/privacy policy as part of this visual redesign. No captcha, passkey or extra profile field is claimed configured. Reauthentication, linked-account last-method restrictions, sessions and password components retain their existing conditional contracts.

Browser Pro at $10/month and 1,000,000 quota comes from the source-owned browser fixture. Period dates 2026-01-01 to 2099-01-01 are that fixture, not live billing data or a commercial price promise. Usage consumed is synthetic. Never copy old fallback billing dates into a live account. External OAuth/checkout/portal pages remain provider-owned; Journl redirect/pending/error/return states are illustrated.

All these interactions require implementation and runtime tests. Static rendering, contrast calculations and image decoding do not prove focus, gestures, provider success, state retention or full accessibility.

Selection panels are drawn in context in the selection-* fullframes. Their toolbar stays anchored to the retained selection. On mobile, the compact toolbar exposes type/link/marks/alignment/colors/More; the popover uses the available width and scrolls internally. The floating Ask Journl pill yields while a selection popover owns the interaction, then returns on dismissal.

The current runtime audit now includes 51 unique capture artifacts: 38 initial-only IDs and 13 verified extra IDs. Duplicate index references are retained as provenance, not counted twice. Eight selected existing tests passed with zero skips. Initial editor menu attempts marked unconfirmed are superseded by the keyboard-verified captures. Semantic note-search results remain unavailable without an external embedding provider. No exact proposal/current fixture pairs are claimed.

Profile changes keep the current email verification and reauthentication rules. A shared visual Save action must not report an email change as complete before the existing flow succeeds. On mobile, the agent is already a full-height sheet, so it has no redundant expand control.


## v2 route header and Library revision

Keep the Journl wordmark only in the left navigation. Journal context uses the current date. Entries / Timeline and date/history belong only to Journal routes. Library context uses Library, with the active list heading below. Page context uses the folder path and document title. Other routes keep their own context. Narrow route menus inherit this scope: never show Journal view modes on Library, Page, account or Explore routes.

All pages and Folders are views of existing data. All pages search matches page names; it does not silently replace global semantic notebook search. Preserve row actions, open-page/open-folder behavior and existing cursor pagination when integrated. Empty query shows all accessible pages; Clear returns to that list. Preserve the query through row-menu dismissal and do not clear editor drafts when navigating from a result. The examples contain three pages, so no pagination controls are drawn in this fixture. Do not treat those counts as a fixed page limit.
