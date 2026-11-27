import type { SVGProps } from "react";

// The upstream ThemePreviewSystem fills its dark half with plain black over a
// white half, which reads as a rendering wedge on the pastel application card.
// This preview keeps the library's 240x117 diagonal-split composition but
// paints each half with the approved theme surfaces and boundaries from
// docs/design-handoff/foundations.md, so the System tile reads as a composite
// of the Light and Dark themes instead of a black wedge.
const LIGHT_SURFACE = "#ffffff";
const LIGHT_SECONDARY = "#f3f3f4";
const LIGHT_BOUNDARY = "#d9dade";
const DARK_SURFACE = "#111112";
const DARK_SECONDARY = "#232325";
const DARK_BOUNDARY = "#2c2c30";

export function SystemThemePreview(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 240 117"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="System theme preview"
      {...props}
    >
      {/* Dark half: full rounded plate with the bottom-right corner. */}
      <path
        d="M12 0.5H228C234.351 0.5 239.5 5.64873 239.5 12V105C239.5 111.351 234.351 116.5 228 116.5H12C5.64873 116.5 0.5 111.351 0.5 105V12C0.5 5.64873 5.64873 0.5 12 0.5Z"
        fill={DARK_SURFACE}
      />
      {/* Light half: the upper-left triangle with the top-left corner. */}
      <path
        d="M239.5 0.5H12C5.64873 0.5 0.5 5.64873 0.5 12V116.5L239.5 0.5Z"
        fill={LIGHT_SURFACE}
      />
      {/* Approved surface boundaries replace the single zinc outline. */}
      <path
        d="M239.5 0.5H12C5.64873 0.5 0.5 5.64873 0.5 12V116.5"
        stroke={LIGHT_BOUNDARY}
      />
      <path
        d="M239.5 0.5V105C239.5 111.351 234.351 116.5 228 116.5H0.5"
        stroke={DARK_BOUNDARY}
      />
      {/* Light-half chrome, mirrors the Light tile's bars. */}
      <rect x="17" y="20" width="88" height="12" rx="6" fill={LIGHT_BOUNDARY} />
      <rect
        x="17"
        y="44"
        width="98"
        height="16"
        rx="8"
        fill={LIGHT_SECONDARY}
      />
      <rect x="17" y="72" width="56" height="8" rx="4" fill={LIGHT_SECONDARY} />
      {/* Dark-half chrome, mirrors the Dark tile's bars. */}
      <rect x="96" y="32" width="56" height="8" rx="4" fill={DARK_SECONDARY} />
      <rect
        x="154"
        y="56"
        width="68"
        height="16"
        rx="8"
        fill={DARK_SECONDARY}
      />
      <rect x="196" y="84" width="28" height="8" rx="4" fill={DARK_BOUNDARY} />
    </svg>
  );
}
