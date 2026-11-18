import Image from "next/image";

/** Exact approved Shifted right artwork, with theme-specific supplied exports. */
export function Brand() {
  return (
    <span className="block h-10 w-36 shrink-0" role="img" aria-label="Journl">
      <Image
        src="/brand/lockup-light.svg"
        alt=""
        width={144}
        height={40}
        className="h-full w-full object-contain dark:hidden"
        loading="eager"
        unoptimized
      />
      <Image
        src="/brand/lockup-dark.svg"
        alt=""
        width={144}
        height={40}
        className="hidden h-full w-full object-contain dark:block"
        loading="eager"
        unoptimized
      />
    </span>
  );
}
