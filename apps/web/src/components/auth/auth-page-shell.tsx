import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "~/components/brand";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh w-full grid-rows-[auto_1fr] gap-3 p-3 md:grid-cols-2 md:grid-rows-1 md:gap-8 md:p-8">
      <div className="flex flex-col justify-between gap-8 px-3 py-4 md:px-8 md:py-8">
        <Brand className="h-10" />
        <div className="hidden max-w-md md:block">
          <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
            Your knowledge, together
          </p>
          <p className="mt-5 text-balance font-semibold text-5xl tracking-tight lg:text-6xl">
            A home for what matters.
          </p>
          <p className="mt-8 max-w-xs text-lg text-muted-foreground">
            Projects, notes, recipes, references. Keep the pieces close.
          </p>
        </div>
        <p className="hidden text-muted-foreground text-sm md:block">
          Access is currently by invitation.
        </p>
      </div>
      <section className="flex min-w-0 flex-col items-center rounded-3xl border bg-card px-2 py-4 text-card-foreground md:justify-center md:p-8">
        <div className="w-full max-w-[432px] [&>[data-slot=card]]:max-w-none">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-muted-foreground text-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}
