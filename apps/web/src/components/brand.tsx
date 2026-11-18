import Image from "next/image";

/** Exact approved Shifted right artwork, with theme-specific supplied exports. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={
        compact ? "block h-8 w-30 shrink-0" : "block h-10 w-36 shrink-0"
      }
      role="img"
      aria-label="Journl"
    >
      {(["light", "dark"] as const).map((theme) => (
        <picture
          key={theme}
          className={
            theme === "light"
              ? "block h-full dark:hidden"
              : "hidden h-full dark:block"
          }
        >
          <source
            media="(forced-colors: active) and (prefers-color-scheme: dark)"
            srcSet="/brand/lockup-mono-white.svg"
          />
          <source
            media="(forced-colors: active)"
            srcSet="/brand/lockup-mono-ink.svg"
          />
          <Image
            src={`/brand/lockup-${theme}.svg`}
            alt=""
            width={144}
            height={40}
            className="h-full w-full object-contain"
            loading="eager"
            unoptimized
          />
        </picture>
      ))}
    </span>
  );
}
