import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, test } from "~/testing/browser/fixtures";
import { renderedTextContrast } from "~/testing/browser/rendered-contrast";
import { captureSettledShell } from "~/testing/browser/shell-capture";

/**
 * The approved marketing plates are light-theme, full-page captures:
 * docs/design-handoff/screenshots/marketing-light.png (1440 wide) and
 * marketing-mobile.png (390 wide). Dark keeps the same geometry through the
 * application theme tokens; its hero swaps to the canonical dark capture.
 */

/** Canonical v5 all-pages Library PNGs, verbatim in public/marketing. */
const heroHashes = {
  "/marketing/library-dark-mobile.png":
    "5688618dbe0ff8f46741d0f77b22aa9e8e68e2e94eeae7e2de4403362c76b5ae",
  "/marketing/library-dark.png":
    "d2325214908e3b10a36b8dd1368b0c953a087824c871d9774358e368db23dd91",
  "/marketing/library-light-mobile.png":
    "635c41809bf5f47a7ea857b3f619abce084b8a2cc8ac9fb7a9cea49446466018",
  "/marketing/library-light.png":
    "ed05a44f89ded4fbbc385f009e52bb33214cf795c6909ef2ca8a0ddb1ae8bdb2",
};

const headline = { level: 1, name: /give your knowledge a home/i };

type HeroBox = {
  height: number;
  naturalHeight: number;
  naturalWidth: number;
  width: number;
  x: number;
  y: number;
} | null;

type MarketingGeometry = {
  boxes: Record<string, HeroBox>;
  rhythm: {
    captionToOrganization: number;
    heroToProductFrame: number;
    navToHero: number;
  };
};

/** The fixture signs the plain user in; the marketing page is public. */
async function renderSignedOut(page: Page) {
  await page.context().clearCookies();
}

function marketingGeometry(page: Page): Promise<MarketingGeometry> {
  return page.evaluate(() => {
    const box = (selector: string): HeroBox => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        height: rect.height,
        naturalHeight: (element as HTMLImageElement).naturalHeight,
        naturalWidth: (element as HTMLImageElement).naturalWidth,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      };
    };
    const edge = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return Number.NaN;
      const rect = element.getBoundingClientRect();
      return rect.y + rect.height;
    };
    const top = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return Number.NaN;
      return element.getBoundingClientRect().y;
    };
    return {
      boxes: {
        canonicalDark: box(".canonical-hero-dark"),
        canonicalDesktop: box(".canonical-hero-desktop.canonical-hero-light"),
        canonicalMobile: box(".canonical-hero-mobile.canonical-hero-light"),
        caption: box(".composition-caption"),
        context: box(".context-section"),
        end: box(".marketing-end"),
        footer: box(".marketing-footer"),
        hero: box(".hero-new"),
        heroCta: box(".hero-description > .btn.primary"),
        lockup: box(".marketing-nav .journl-brand"),
        nav: box(".marketing-nav"),
        navDescription: box(".marketing-nav .nav-description"),
        organization: box(".organization"),
        productFrame: box(".product-frame"),
      },
      rhythm: {
        captionToOrganization:
          top(".organization") - edge(".composition-caption"),
        heroToProductFrame: top(".product-frame") - edge(".hero-new"),
        navToHero: top(".hero-new") - edge(".marketing-nav"),
      },
    };
  });
}

test("signed-in visitors keep the existing journal redirect", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Route guard check");
  // The fixture user is signed in; withoutAuth must keep routing them home.
  await page.goto("/");
  await expect(page).toHaveURL(/\/journal$/);
});

test("light desktop marketing keeps the approved plate geometry", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Plate geometry");
  await renderSignedOut(page);
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.addInitScript(
    (value) => localStorage.setItem("theme", value),
    "light",
  );
  await page.goto("/");
  const heading = page.getByRole("heading", headline);
  await expect(heading).toBeVisible();

  for (const [file, sha256] of Object.entries(heroHashes)) {
    const response = await page.request.get(file);
    expect(response.ok(), `${file} must be served`).toBe(true);
    const hash = createHash("sha256")
      .update(await response.body())
      .digest("hex");
    expect(hash, `${file} is the verbatim canonical PNG`).toBe(sha256);
  }

  const { boxes, rhythm } = await marketingGeometry(page);
  expect(boxes.nav).toMatchObject({ height: 80, width: 1312, x: 64, y: 24 });
  // Brand rule: the marketing lockup is 32px tall.
  expect(boxes.lockup).toMatchObject({ height: 32, y: 48 });
  // Hero contract: the exact all-pages PNG, width 100%, height auto, 1.44.
  expect(boxes.canonicalDesktop).toMatchObject({
    naturalHeight: 1000,
    naturalWidth: 1440,
    x: 65,
  });
  expect(boxes.canonicalDesktop?.width).toBe(1310);
  expect(boxes.canonicalDesktop?.height).toBeCloseTo(909.7, 0);
  expect(boxes.productFrame).toMatchObject({ width: 1312, x: 64 });

  // Approved section rhythm: nav +80 hero, hero +48 product frame,
  // caption +112 organization.
  expect(rhythm.navToHero).toBe(80);
  expect(rhythm.heroToProductFrame).toBe(48);
  expect(rhythm.captionToOrganization).toBe(112);

  const primary = page.locator(".hero-description > .btn.primary");
  await expect(primary).toHaveCSS("background-color", "rgb(160, 229, 205)");
  await expect(primary).toHaveCSS("min-height", "48px");
  await expect(page.locator(".marketing-nav .btn.primary")).toHaveCSS(
    "background-color",
    "rgb(160, 229, 205)",
  );

  // Feature parity: every public route target still links somewhere real.
  const navActions = page.locator(".marketing-nav .public-actions a");
  await expect(navActions).toHaveCount(2);
  await expect(navActions.first()).toHaveAttribute("href", "/auth/sign-in");
  await expect(navActions.nth(1)).toHaveAttribute("href", "/invite");

  const weakest = [];
  for (const [label, locator] of [
    ["headline", page.locator(".hero-new h1")],
    ["hero copy", page.locator(".hero-description > p")],
    ["nav description", page.locator(".marketing-nav .nav-description")],
    ["use-case chip", page.locator(".use-case .example").first()],
    ["footer link", page.locator(".marketing-footer nav a").first()],
  ] as const) {
    const contrast = await renderedTextContrast(locator);
    expect(contrast.ratio, `${label} contrast`).toBeGreaterThanOrEqual(4.5);
    weakest.push({
      glyphLabel: contrast.glyphLabel,
      label,
      ratio: contrast.ratio,
    });
  }

  await captureSettledShell(page, info.outputPath("settled-shell.png"));
  await page.screenshot({
    animations: "allow",
    fullPage: true,
    path: info.outputPath("marketing-light-desktop.png"),
    scale: "css",
  });
  await writeFile(
    info.outputPath("marketing-light-desktop-geometry.json"),
    JSON.stringify({ boxes, rhythm, weakest }, null, 2),
  );
  await info.attach("marketing-contrast", {
    body: JSON.stringify(weakest),
    contentType: "application/json",
  });
});

test("dark desktop marketing swaps the canonical hero through theme tokens", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Theme swap");
  await renderSignedOut(page);
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.addInitScript(
    (value) => localStorage.setItem("theme", value),
    "dark",
  );
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(16, 27, 48)",
  );
  const darkHero = page.locator(".canonical-hero-desktop.canonical-hero-dark");
  await expect(darkHero).toBeVisible();
  await expect(
    page.locator(".canonical-hero-desktop.canonical-hero-light"),
  ).toBeHidden();
  await expect(page.locator(".journl-brand .brand-dark")).toBeVisible();
  const { boxes, rhythm } = await marketingGeometry(page);
  expect(boxes.nav).toMatchObject({ height: 80, width: 1312, x: 64, y: 24 });
  expect(boxes.canonicalDark).toMatchObject({
    naturalHeight: 1000,
    naturalWidth: 1440,
  });
  expect(boxes.canonicalDark?.width).toBe(1310);
  expect(boxes.canonicalDark?.height).toBeCloseTo(909.7, 0);
  expect(rhythm.navToHero).toBe(80);
  const contrast = await renderedTextContrast(page.locator(".hero-new h1"));
  expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
  await captureSettledShell(page, info.outputPath("settled-shell-dark.png"));
  await page.screenshot({
    animations: "allow",
    fullPage: true,
    path: info.outputPath("marketing-dark-desktop.png"),
    scale: "css",
  });
});

test("light mobile marketing stacks the approved single column", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Plate geometry");
  await renderSignedOut(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.addInitScript(
    (value) => localStorage.setItem("theme", value),
    "light",
  );
  await page.goto("/");
  const heading = page.getByRole("heading", headline);
  await expect(heading).toBeVisible();

  const { boxes, rhythm } = await marketingGeometry(page);
  expect(boxes.nav).toMatchObject({ height: 68, width: 366, x: 12, y: 12 });
  // The lockup stays 32px tall on mobile; only the description collapses.
  expect(boxes.lockup?.height).toBe(32);
  expect(boxes.navDescription?.height ?? 0).toBe(0);
  // Mobile hero: the 390x844 canonical capture inside 12px margins.
  expect(boxes.canonicalMobile).toMatchObject({
    naturalHeight: 844,
    naturalWidth: 390,
    x: 13,
  });
  expect(boxes.canonicalMobile?.width).toBe(364);
  expect(boxes.canonicalMobile?.height).toBeCloseTo(787.9, 0);
  expect(boxes.canonicalDesktop?.height ?? 0).toBe(0);
  await expect(page.locator(".marketing-nav")).toHaveCSS(
    "border-radius",
    "20px",
  );
  expect(rhythm.navToHero).toBe(48);

  // Single-column hero: the invitation action spans the narrative column.
  const cta = page.locator(".hero-description > .btn.primary");
  const ctaBox = await cta.boundingBox();
  expect(ctaBox?.width).toBe(342);
  await expect(cta).toHaveCSS("background-color", "rgb(160, 229, 205)");
  await expect(page.locator(".organization")).toHaveCSS("display", "block");
  await expect(page.locator(".hero-new")).toHaveCSS("flex-direction", "column");

  const contrast = await renderedTextContrast(page.locator(".hero-new h1"));
  expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);

  await captureSettledShell(page, info.outputPath("settled-shell-mobile.png"));
  await page.screenshot({
    animations: "allow",
    fullPage: true,
    path: info.outputPath("marketing-light-mobile.png"),
    scale: "css",
  });
  await writeFile(
    info.outputPath("marketing-light-mobile-geometry.json"),
    JSON.stringify({ boxes, rhythm }, null, 2),
  );
});

test("mobile webkit renders the marketing page", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-webkit", "Cross-browser smoke");
  await renderSignedOut(page);
  await page.goto("/");
  const heading = page.getByRole("heading", headline);
  await expect(heading).toBeVisible();
  const hero = page.locator(".canonical-hero-mobile.canonical-hero-light");
  await expect(hero).toBeVisible();
  expect(
    await hero.evaluate((img) => (img as HTMLImageElement).naturalWidth),
  ).toBe(390);
  await expect(page.locator(".organization .use-case")).toHaveCount(3);
  const contrast = await renderedTextContrast(page.locator(".hero-new h1"));
  expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
  await info.attach("webkit-hero-contrast", {
    body: JSON.stringify({ ratio: contrast.ratio }),
    contentType: "application/json",
  });
});
