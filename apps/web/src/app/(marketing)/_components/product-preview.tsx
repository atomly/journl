import Image from "next/image";

/** The exact approved Library captures; preserve the device-specific full frame. */
export function ProductPreview() {
  return (
    <>
      {(["light", "dark"] as const).map((theme) => (
        <picture
          key={theme}
          className={
            theme === "light" ? "block dark:hidden" : "hidden dark:block"
          }
        >
          <source
            media="(max-width: 700px)"
            srcSet={`/design/library-${theme}-mobile.png`}
            width={390}
            height={844}
          />
          <Image
            src={`/design/library-${theme}-desktop.png`}
            alt="Journl Library with project notes, recipes and references organized in folders"
            width={1440}
            height={1000}
            className="h-auto w-full"
            loading="eager"
            unoptimized
          />
        </picture>
      ))}
    </>
  );
}
