import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "~/components/brand";
import "./auth-shell.css";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page-shell">
      <aside className="auth-story">
        <Link href="/" aria-label="Back to home">
          <Brand />
        </Link>
        <div className="auth-story-copy">
          <p className="auth-eyebrow">YOUR KNOWLEDGE, TOGETHER</p>
          <h1>
            A home for
            <br />
            what matters.
          </h1>
          <p>
            Projects, notes, recipes, references.
            <br />
            Keep the pieces close.
          </p>
        </div>
        <small>Access is currently by invitation.</small>
      </aside>
      <section className="auth-reading-surface">
        <div className="auth-form-content">{children}</div>
      </section>
    </main>
  );
}
