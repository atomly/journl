import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { withoutAuth } from "~/app/_guards/page-guards";
import { Brand } from "~/components/brand";
import { getPublicWebUrl } from "~/lib/public-web-url";

const publicWebUrl = getPublicWebUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  description:
    "Projects, passing thoughts, recipes, references. Bring them together in Journl, so a good idea is there when you need it.",
  keywords: [
    "notes app",
    "personal knowledge base",
    "organize notes",
    "project notes",
    "recipes and references",
  ],
  metadataBase: new URL(publicWebUrl),
  openGraph: {
    description:
      "Give your knowledge a home. Projects, recipes, and references stay close, findable, and connected.",
    images: [
      {
        alt: "Journl",
        height: 630,
        url: "/acme-icon.svg",
        width: 1200,
      },
    ],
    siteName: "Journl",
    title: "Journl · A home for useful knowledge",
    type: "website",
    url: publicWebUrl,
  },
  robots: {
    follow: true,
    index: true,
  },
  title: "Journl · A home for useful knowledge",
  twitter: {
    card: "summary_large_image",
    description:
      "Give your knowledge a home. Projects, recipes, and references stay close, findable, and connected.",
    images: ["/acme-icon.svg"],
    title: "Journl · A home for useful knowledge",
  },
};

export const viewport: Viewport = {
  themeColor: [{ color: "black" }],
};

/** Approved outlined 1.7px-stroke family used by the marketing plates. */
function LandingIcon({ d }: { d: string }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      <path d={d} />
    </svg>
  );
}

const arrowPath = "M5 12h14M13 6l6 6-6 6";
const chatPath = "M4 4h16v13H9l-5 4z";
const folderPath = "M3 6h7l2 3h9v11H3z";
const pagePath = "M6 3h12v18H6zM9 8h6M9 12h6";
const explorePath = "M5 5l14 5-9 9z";

/**
 * The canonical v5 all-pages Library capture, verbatim per hero contract:
 * theme- and device-matched PNGs, width 100%, height auto, no cropping.
 * Hidden variants stay unfetched through loading="lazy".
 */
function CanonicalHero() {
  return (
    <>
      <Image
        alt="Journl Library dashboard with the complete desktop application shell"
        className="canonical-hero canonical-hero-desktop canonical-hero-light"
        height={1000}
        src="/marketing/library-light.png"
        unoptimized
        width={1440}
      />
      <Image
        alt=""
        className="canonical-hero canonical-hero-desktop canonical-hero-dark"
        height={1000}
        loading="lazy"
        src="/marketing/library-dark.png"
        unoptimized
        width={1440}
      />
      <Image
        alt=""
        className="canonical-hero canonical-hero-mobile canonical-hero-light"
        height={844}
        loading="lazy"
        src="/marketing/library-light-mobile.png"
        unoptimized
        width={390}
      />
      <Image
        alt=""
        className="canonical-hero canonical-hero-mobile canonical-hero-dark"
        height={844}
        loading="lazy"
        src="/marketing/library-dark-mobile.png"
        unoptimized
        width={390}
      />
    </>
  );
}

const useCases = [
  {
    copy: "The plan, the useful reference, the idea you had on the way home. Keep the pieces where you can find them.",
    example: "Projects / A small balcony garden",
    icon: folderPath,
    no: "01",
    title: "Make room for a project.",
  },
  {
    copy: "A recipe worth making again. A small adjustment that made it yours. Save more than the link.",
    example: "Recipes / Lemon & herb lentils",
    icon: pagePath,
    no: "02",
    title: "Keep the everyday good stuff.",
  },
  {
    copy: "Collect references alongside your own thoughts. Explore the threads between notes, with the original context close.",
    example: "References / Make room for focus",
    icon: explorePath,
    no: "03",
    title: "Return to a useful idea.",
  },
];

export default withoutAuth(function RootPage() {
  return (
    <main className="marketing">
      <nav aria-label="Public navigation" className="marketing-nav">
        <Brand className="h-8 shrink-0" />
        <span className="nav-description">A home for useful knowledge</span>
        <div className="public-actions">
          <Link className="btn sign-in" href="/auth/sign-in">
            Sign in
          </Link>
          <Link className="btn primary" href="/invite">
            Get started <LandingIcon d={arrowPath} />
          </Link>
        </div>
      </nav>

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
          <p>
            Projects, passing thoughts, recipes, references. Bring them together
            in Journl, so a good idea is there when you need it.
          </p>
          <Link className="btn primary" href="/invite">
            Get started with an invitation <LandingIcon d={arrowPath} />
          </Link>
          <small>
            Access is currently by invitation.
            <br />
            Already have a notebook?{" "}
            <Link className="sign-in" href="/auth/sign-in">
              Sign in
            </Link>
          </small>
        </div>
      </section>

      <section
        aria-label="Example Journl library"
        className="product-frame"
        id="capture"
      >
        <CanonicalHero />
      </section>

      <div className="composition-caption">
        <span>A project. A recipe. A reference. One place to return to.</span>
        <span>Actual redesigned Library capture · synthetic example notes</span>
      </div>

      <section className="organization" id="connect">
        <div>
          <p className="eyebrow">LESS SCATTERED. MORE USEFUL.</p>
          <h2>
            Your life doesn&rsquo;t
            <br />
            fit in one kind
            <br />
            of note.
          </h2>
          <p className="body-copy">
            Keep a quick thought beside the things you&rsquo;re working on. Give
            pages a home in folders. Find what matters by name, or follow a
            connection back to its source.
          </p>
        </div>
        <div className="use-cases">
          {useCases.map(({ copy, example, icon, no, title }) => (
            <article className="use-case" key={no}>
              <span className="case-no">{no}</span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
                <span className="example">
                  <LandingIcon d={icon} />
                  {example}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="context-section" id="rediscover">
        <div className="context-copy">
          <p className="eyebrow">THEN, FIND THE THREAD.</p>
          <h2>
            A little help.
            <br />
            Your own context.
          </h2>
          <p>
            Ask Journl about a note and keep the source in view. Explore a
            thought, find a connection, or turn a loose idea into a useful next
            question.
          </p>
        </div>
        <div className="context-card">
          <header>
            <LandingIcon d={chatPath} />
            Ask Journl
          </header>
          <div className="context-answer">
            <p className="context-question">
              What would help me make room for focus?
            </p>
            <p>
              Your note comes back to one idea: make space before making a plan.
              A useful question to keep close might be:
            </p>
            <p className="context-keep">
              What could I leave a little more room for today?
            </p>
            <span className="source-example">1 · Make room for focus</span>
          </div>
          <small>
            Illustrative response, grounded in the synthetic example note.
          </small>
        </div>
      </section>

      <section className="marketing-end">
        <p className="eyebrow">KEEP WHAT MATTERS. FIND IT AGAIN.</p>
        <h2>
          Keep it close.
          <br />
          Find it again.
        </h2>
        <p>Have an invitation? Your notebook is waiting.</p>
        <div className="public-actions">
          <Link className="btn primary" href="/invite">
            Get started <LandingIcon d={arrowPath} />
          </Link>
          <Link className="btn sign-in" href="/auth/sign-in">
            Sign in
          </Link>
        </div>
      </section>

      <footer className="marketing-footer">
        <Link aria-label="Journl home" className="brand" href="/">
          <Brand className="h-8" />
        </Link>
        <nav aria-label="Footer">
          <a href="#capture">Capture</a>
          <a href="#connect">Connect</a>
          <a href="#rediscover">Rediscover</a>
          <Link className="sign-in" href="/auth/sign-in">
            Sign in
          </Link>
          <Link className="btn primary" href="/invite">
            Get started <LandingIcon d={arrowPath} />
          </Link>
        </nav>
        <span className="copyright">© 2026 Journl. All rights reserved.</span>
      </footer>
    </main>
  );
});
