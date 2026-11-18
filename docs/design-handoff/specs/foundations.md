# Journl visual foundations

Use these specifications together with the canonical views. The PNGs govern visual composition; these rules define the shared visual system.

## Semantic tokens

These are the actual approved values in `reference/visual-system.css`. Use the supplied CSS reference together with these specifications.

| Role | Light | Dark |
|---|---|---|
| Canvas | #E9EFFB | #101B30 |
| Opaque reading surface | #FCFDFF | #19263B |
| Secondary surface | #E8EEF9 | #23334C |
| Solid navigation fallback | #E5ECFB | #23324D |
| Main ink | #213451 | #EEF3FF |
| Muted ink | #52627C | #BAC8E1 |
| Control boundary | #98A8C2 | #7084A5 |
| Surface boundary | #BDCBE0 | #435675 |
| Focus | #3156BD | #BACBFF |
| Link | #304D8B | #BDCCFF |
| Destructive text | #A52638 | #FFAFBC |
| Disabled surface | #DCE3EF | #35445C |
| Disabled ink | #59677E | #C2CDE1 |
| Mint action | #A0E5CD | same |
| Periwinkle selection | #C4CBFF | same |
| Peach reference | #FFC8A8 | same |
| Lavender assistant | #DECAFA | same |
| Ink on pastels | #21304A | same |
| Reserved meaningful feedback | #F4DF92 | same |

Mint identifies primary actions. Periwinkle identifies the selected navigation or view. Peach identifies references. Lavender identifies assistant controls. Do not replace these roles with blue. Destructive actions use explicit wording and destructive text, not color alone.

## Functional glass

Light fill: rgba(239,245,255,.58). Dark fill: rgba(42,61,94,.64). Light highlight: rgba(255,255,255,.93). Dark highlight: rgba(170,197,245,.35). Lower edges: rgba(112,135,177,.44) / rgba(8,18,37,.82). Ambient colors: #B7CCF4 and #D8D4F3 in light, #2A4779 and #343454 in dark. Backdrop blur is 24px with saturation 1.15. Broad shadow uses the approved theme-specific `--depth` token. See the token source for exact multi-shadow values.

Glass belongs on floating navigation, route headers, assistant headers, transient menus and the marketing navigation. Reading and conversation surfaces stay opaque. These are web effects, not native Apple optics. Decorative gradients in the inherited system are limited to ambient light and material highlights.

Reduced transparency uses solid navigation colors and removes blur. `opaque-mode` provides the same review fixture. Higher contrast also removes transparent dependence. Forced colors uses Canvas, CanvasText, ButtonFace, ButtonText, Highlight and HighlightText. Selected items retain system-color fills. Do not infer dark-mode contrast from light mode.

## Typography

Use local `assets/fonts/inter-variable.ttf` for all UI, the brand and marketing display type. The OFL license and original font-source record accompany the file. Use 400 for body, 500 for labels, and 600 for headings and selected controls. No remote font dependency is required.

| Element | Desktop | Mobile | Line height |
|---|---|---|---|
| Brand | 32px | 28px / approved marketing 25px | 1.2–1.4 |
| Main app heading | 40–44px | 30–32px | 1.12–1.2 |
| Secondary state heading | 32px | 27px | 1.2 |
| Reading text | 17–18px | 16–17px | 1.7 |
| Standard controls | 14–15px | 14–16px | 20–24px |
| Metadata | 13px | 13px | 1.6 |
| Eyebrow | 11px | 10–11px | 1.5 |
| Marketing hero | 88px | 52px | 1.02–1.04 |
| Marketing sections | 56px | 38px | 1.08–1.13 |

The approved compact metadata and controls remain below the general 16px body baseline. This is an inherited, documented direction choice. Reading text remains larger. Full document columns are capped at 680px. Use normal wrapping for authored copy and detail text. Lists may truncate data only if the full value remains reachable.

## Geometry and density

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. Desktop outer inset and inter-panel gap: 16px. Mobile: 12px. Floating panel radius: 24px. Controls: 12px. Menus: 16px. Assistant pill: 32px. Reading content padding: 48px 56px on wide layouts, 32px on tablet, 24px 20px on mobile. Secondary state surfaces use the same typography and materials as complete routes.

Minimum interactive target is 44×44 CSS pixels on touch. Repeated mobile actions are separated by 8–12px. Thin separators may have a larger invisible interaction area. Long menu labels wrap. Icons use the inherited coherent outlined SVG family with 1.7px strokes and a normal 20px viewport. A glyph's explicit box controls its geometry. Content diagrams retain their own aspect ratios.

## Control states

Default controls use explicit theme-aware foreground and background. Primary controls use mint and dark ink. Hover uses `--hover`; primary hover keeps mint with an inset dark boundary. Keyboard focus uses a distinct 3px ring with 3px offset. A selected navigation pill has no left stripe, persistent outline, rim or shadow. It uses periwinkle, dark ink and semibold text.

Disabled controls retain labels, opaque disabled fills and disabled ink. They cannot submit. Pending operations keep entered values and identify the operation in text. Skeletons reserve content geometry. Errors appear next to the operation or field and give a retry or recovery path. Read-only content keeps selection, copy and source navigation while mutation controls are removed or disabled by capability.

Layering: base document 0; functional chrome 2; assistant pill 3; menus 20; modal layer 40 plus browser top layer. Menu and modal placements must remain inside the visible viewport. Escape closes transient UI and returns focus to a live equivalent trigger.

## Motion

Small state transitions use 180ms ease-out on entry and approximately 120ms ease-in on exit. Larger transitions stay at or below 400ms. Resize follows the pointer directly, not an animated width transition. Reduced motion removes animation, transitions and smooth scroll. No decorative motion is required.
