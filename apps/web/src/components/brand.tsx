import { cn } from "@acme/ui/utils";
import Image from "next/image";

/** Exact approved artwork. Consumers own link semantics and placement. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("journl-brand inline-flex h-10", className)}>
      {/* SVG wordmarks are outlined paths, not live text. */}
      <Image
        unoptimized
        width={235}
        height={64}
        className="brand-light h-full w-auto"
        src="/brand/lockup-light.svg"
        alt="Journl"
      />
      <Image
        unoptimized
        width={235}
        height={64}
        className="brand-dark hidden h-full w-auto"
        src="/brand/lockup-dark.svg"
        alt="Journl"
      />
      <Image
        unoptimized
        width={235}
        height={64}
        className="brand-mono hidden h-full w-auto"
        src="/brand/lockup-mono-ink.svg"
        alt="Journl"
      />
    </span>
  );
}
