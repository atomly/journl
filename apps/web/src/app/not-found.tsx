import { Button } from "@acme/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-y-2 bg-amber-50 p-4">
      <section
        aria-label="Page not found"
        className="min-h-45 px-8 text-zinc-800"
      >
        <h1 className="mb-3 font-semibold text-3xl">Journl #404</h1>
        <ul className="list-disc pl-6 text-base">
          <li>Page not found.</li>
          <li>Error: #404</li>
        </ul>
      </section>
      <Link href="/">
        <Button>Go back to the home page</Button>
      </Link>
      <div className="flex items-center gap-x-1">
        <span className="text-muted-foreground text-sm">No account?</span>
        <Button className="p-0 text-blue-600" variant="link" asChild>
          <a href="/invite">Use an invite</a>
        </Button>{" "}
      </div>
    </div>
  );
}
