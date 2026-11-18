# Journl v4.3 design specifications

CANDIDATE / NOT APPROVED. Exact PNGs are canonical.

## Direction and preserved scope

Continue v4.2's Inter typography, content, control set, and main app geometry. Restore a cool-blue atmosphere informed by the supplied v4.1 cobalt/apricot scenes. Keep the four semantic pastels in both modes. Do not restore boxed ordinal numbers.

Glass identifies functional chrome: sidebar, top bar, view switch, assistant header, transient surfaces, and marketing navigation. Reading and conversation surfaces remain opaque. Ambient blue and lilac light belongs behind chrome rather than inside every content region. Highlights and shadows communicate layer separation at the requested screenshot sizes. These are web material effects, not native Apple optics.

The review gallery is a presentation wrapper for exact PNG bytes. It does not repaint the app. Scene HTML supplies editable rendering sources and the limited interactions needed for state proofs.

## Semantic colors

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#E9EFFB` | `#101B30` |
| Opaque reading surface | `#FCFDFF` | `#19263B` |
| Secondary surface | `#E8EEF9` | `#23334C` |
| Solid navigation fallback | `#E5ECFB` | `#23324D` |
| Main ink | `#213451` | `#EEF3FF` |
| Muted ink | `#52627C` | `#BAC8E1` |
| Control boundary | `#98A8C2` | `#7084A5` |
| Surface boundary | `#BDCBE0` | `#435675` |
| Keyboard focus | `#3156BD` | `#BACBFF` |
| Mint action | `#A0E5CD` | same |
| Periwinkle selection | `#C4CBFF` | same |
| Peach reference | `#FFC8A8` | same |
| Lavender assistant | `#DECAFA` | same |
| Ink on all pastel fills | `#21304A` | same |

Butter `#F4DF92` remains reserved for meaningful existing feedback. It is not added as decoration. Functional icons retain the baseline's coherent outlined family.

Tokens are defined once in `sources/v43.css`, with selectors for both scene bodies and specimen samples. A dark sample does not depend on the page body's mode. Pastel foreground colors are explicit, including dark mode. This prevents the two specimen and dark-control scope failures noted in the brief.

## Materials

| Property | Light | Dark |
| --- | --- | --- |
| Glass fill | `rgba(239,245,255,.58)` | `rgba(42,61,94,.64)` |
| Highlight edge | `rgba(255,255,255,.93)` | `rgba(170,197,245,.35)` |
| Lower edge | `rgba(112,135,177,.44)` | `rgba(8,18,37,.82)` |
| Broad blue ambient | `#B7CCF4` | `#2A4779` |
| Secondary lilac ambient | `#D8D4F3` | `#343454` |
| Backdrop blur | 24px | 24px |
| Backdrop saturation | 1.15 | 1.15 |

Glass combines an alpha fill, a restrained highlight, a lower edge, and soft shadow. Large reading cards use opaque color. The lavender assistant pill keeps its familiar solid semantic fill. It does not rely on translucency for its label contrast.

`prefers-reduced-transparency: reduce` replaces glass fills with opaque navigation colors and removes blur. `.opaque-mode` exposes the same fallback for review testing. `prefers-contrast: more` retains the inherited opaque contrast fallback. Forced colors uses Canvas, CanvasText, ButtonFace, ButtonText, Highlight, and HighlightText. Selection retains an explicit system-color fill. Reduced motion disables scene transitions and smooth scrolling.

## Typography and spacing

Use the supplied local Inter variable font under its existing OFL license. The app retains the baseline's 400/500/600 weight system and type hierarchy. Reading paragraphs are 16–18px. Compact labels retain the baseline's smaller sizes. Marketing display type is Inter 600, with responsive sizes of 88px on the requested desktop and 52px on mobile. Its sections use 56px and 38px headings respectively.

Maintain a 4/8px spacing rhythm, 16px desktop workspace inset/gap, 12px mobile inset/gap, 24px floating panel corners, and 12px control corners. The pill uses a 32px radius. Existing app content is retained even where the requested comparison uses compact text below the general 16px body baseline.

## Selected navigation

A selected navigation button has a periwinkle fill, dark icon, semibold dark label, and `aria-current="page"`. It has no inset stripe, doubled rim, persistent outline, or selected-state shadow. Keyboard `:focus-visible` adds a distinct focus ring. The ring appears for keyboard focus, not because the item is selected.

Default captures move the pointer to the viewport corner and clear focus. Measurements record that the chosen navigation is neither hovered nor focus-visible.

## Row ellipsis behavior

Only sidebar folder/page rows and Library page-row action buttons receive the `row-action` behavior. Account, route, and unrelated ellipses are not included.

On a fine-pointer hover-capable device, the action has opacity 0 at rest. Its slot, accessible name, native button role, and tab order remain intact. It is never removed with `display:none` or `visibility:hidden`. Row hover, row focus-within, trigger focus-visible, and menu-open reveal it.

Triggers have `aria-haspopup="menu"`, `aria-expanded`, and an associated menu ID. Activating a trigger keeps its row's action visible while focus enters the menu. Escape closes the menu and restores trigger focus. Clicking outside also closes it. The scene menu retains the baseline's close-only contents; production menu operations are outside this review.

On coarse pointers or no-hover devices, actions remain visible and use at least 44 × 44px targets. Mobile proof captures use real browser touch/coarse-pointer emulation rather than a desktop page narrowed to 390px.

## Assistant overlay and panel layout

Remove the dock's reserved flex row. Navigation and main panel end at viewport minus 16px on desktop: y=984 at 1000px height. Mobile panels end at y=832 at 844px height with the 12px inset.

The pill is anchored inside the main panel at bottom-right: 24px inset on desktop and 16px on mobile. It has no full-width footer background. The content scroller fills the panel. Its inner trailing padding, scroll padding, and focused-control scroll margin use 112px clearance. The desktop Explore footer also leaves 184px at its right edge so Open thread sits beside the pill in the default view.

Final controls can move above or beside the pill when scrolled or focused. The panel is never shortened to create clearance. Center-point hit tests cover the pill and final controls after end-scroll.

Navigation collapse and resize have independent controls. The balanced assistant remains 480px; expansion remains 704px. Keyboard arrow keys resize the separator. Chat uses separate flex regions for a scrolling conversation and a non-shrinking composer. The composer does not overlay the conversation region.

## Marketing narrative and truthfulness

The landing page leads with organizing and finding knowledge. The main composition uses actual Library concepts: pages, folders, search, All pages/Folders tabs, and Ask Journl. Example folders named Projects, Recipes, and References are synthetic user content, not new application categories or status features.

The narrative proceeds from a knowledge home, to project/everyday/reference examples, to assistant context, then access. The assistant response is labeled illustrative. Writing is an input, not the headline value.

Preserve `/auth/sign-in`, `/invite`, invitation-only access wording, footer home `/`, Capture/Connect/Rediscover anchors, and copyright information. Access invitations are not marketed as note sharing. Do not claim future connectors, note sharing/invites, agent integrations, schedules, reminders, pricing, testimonials, metrics, or security guarantees.

## Published guidance

The following sources inform design decisions only. They are not live-app inspections or an accessibility acceptance result.

- [W3C keyboard guidance](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html): retain keyboard operation for pointer actions.
- [W3C focus-visible guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html): keep the keyboard focus location visible.
- [Apple materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials): distinguish functional layers from readable content and use translucency sparingly.
- [Apple color guidance](https://developer.apple.com/design/human-interface-guidelines/color): give color semantic roles and account for appearance and contrast.
