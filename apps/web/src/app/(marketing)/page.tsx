import { buttonVariants } from "@acme/ui/button";
import { Surface } from "@acme/ui/surface";
import {
  ArrowRight,
  Compass,
  FileText,
  Folder,
  MessageSquare,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { withoutAuth } from "~/app/_guards/page-guards";
import { Brand } from "~/components/brand";
import { ProductPreview } from "./_components/product-preview";

const description =
  "Projects, passing thoughts, recipes, references. Bring them together in Journl, so a good idea is there when you need it.";
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description,
  openGraph: {
    description,
    images: [
      {
        alt: "Your knowledge, together in Journl",
        height: 1000,
        url: "/design/library-light-desktop.png",
        width: 1440,
      },
    ],
    title: "Journl: Your mind, organized",
  },
  title: "Journl: Your mind, organized",
  twitter: {
    card: "summary_large_image",
    description,
    images: ["/design/library-light-desktop.png"],
    title: "Journl: Your mind, organized",
  },
};

function PublicActions() {
  return (
    <div className="public-actions">
      <Link
        className={buttonVariants({ size: "lg", variant: "ghost" })}
        href="/auth/sign-in"
      >
        Sign in
      </Link>
      <Link className={buttonVariants({ size: "lg" })} href="/invite">
        Get started <ArrowRight />
      </Link>
    </div>
  );
}

const useCases = [
  {
    body: "The plan, the useful reference, the idea you had on the way home. Keep the pieces where you can find them.",
    example: "Projects / A small balcony garden",
    icon: Folder,
    title: "Make room for a project.",
  },
  {
    body: "A recipe worth making again. A small adjustment that made it yours. Save more than the link.",
    example: "Recipes / Lemon & herb lentils",
    icon: FileText,
    title: "Keep the everyday good stuff.",
  },
  {
    body: "Collect references alongside your own thoughts. Explore the threads between notes, with the original context close.",
    example: "References / Make room for focus",
    icon: Compass,
    title: "Return to a useful idea.",
  },
];

export default withoutAuth(function RootPage() {
  return (
    <div className="landing">
      <header className="marketing-nav journl-glass">
        <Link href="/" aria-label="Journl home">
          <Brand compact />
        </Link>
        <span className="nav-description">A home for useful knowledge</span>
        <PublicActions />
      </header>
      <main>
        <section className="hero-new">
          <div>
            <p className="eyebrow">FOR EVERYTHING YOU WANT TO KEEP</p>
            <h1>
              Give your
              <br />
              knowledge
              <br />a home.
            </h1>
          </div>
          <div className="hero-description">
            <p>{description}</p>
            <Link className={buttonVariants({ size: "lg" })} href="/invite">
              Get started with an invitation <ArrowRight />
            </Link>
            <small>
              Access is currently by invitation.
              <br />
              Already have a notebook? <Link href="/auth/sign-in">Sign in</Link>
            </small>
          </div>
        </section>
        <section
          id="capture"
          className="product-frame journl-glass"
          aria-label="Example Journl Library"
        >
          <ProductPreview />
        </section>
        <div className="composition-caption">
          <span>A project. A recipe. A reference. One place to return to.</span>
          <span>
            Actual redesigned Library capture · synthetic example notes
          </span>
        </div>
        <section id="connect" className="organization">
          <div>
            <p className="eyebrow">LESS SCATTERED. MORE USEFUL.</p>
            <h2>
              Your life doesn’t
              <br />
              fit in one kind
              <br />
              of note.
            </h2>
            <p className="body-copy">
              Keep a quick thought beside the things you’re working on. Give
              pages a home in folders. Find what matters by name, or follow a
              connection back to its source.
            </p>
          </div>
          <div className="use-cases">
            {useCases.map(({ title, body, example, icon: Icon }, index) => (
              <article className="use-case" key={title}>
                <span className="case-no">0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <span className="example">
                    <Icon size={18} strokeWidth={1.7} />
                    {example}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section id="rediscover" className="context-section">
          <div className="context-copy">
            <p className="eyebrow">THEN, FIND THE THREAD.</p>
            <h2>
              A little help.
              <br />
              Your own context.
            </h2>
            <p>
              Ask Journl about a note and keep the source in view. Explore a
              thought, find a connection, or turn a loose idea into a useful
              next question.
            </p>
          </div>
          <Surface material="glass" className="context-card">
            <header>
              <MessageSquare size={20} strokeWidth={1.7} />
              Ask Journl
            </header>
            <Surface shape="overlay" className="context-answer">
              <p className="context-question">
                What would help me make room for focus?
              </p>
              <p>
                Your note comes back to one idea: make space before making a
                plan. A useful question to keep close might be:
              </p>
              <p className="context-suggestion">
                What could I leave a little more room for today?
              </p>
              <span className="source-example">1 · Make room for focus</span>
            </Surface>
            <small>
              Illustrative response, grounded in the synthetic example note.
            </small>
          </Surface>
        </section>
        <section className="marketing-end">
          <p className="eyebrow">KEEP WHAT MATTERS. FIND IT AGAIN.</p>
          <h2>
            Keep it close.
            <br />
            Find it again.
          </h2>
          <p>Have an invitation? Your notebook is waiting.</p>
          <PublicActions />
        </section>
      </main>
      <footer className="marketing-footer">
        <Link href="/" aria-label="Journl home">
          <Brand compact />
        </Link>
        <nav aria-label="Footer">
          <a href="#capture">Capture</a>
          <a href="#connect">Connect</a>
          <a href="#rediscover">Rediscover</a>
          <Link href="/auth/sign-in">Sign in</Link>
          <Link href="/invite">Get started</Link>
        </nav>
        <span className="copyright">
          © {new Date().getFullYear()} Journl. All rights reserved.
        </span>
      </footer>
    </div>
  );
});
