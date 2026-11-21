import addonA11y from "@storybook/addon-a11y";
import addonDocs from "@storybook/addon-docs";
import { definePreview } from "@storybook/react-vite";

import "../src/review.css";

export default definePreview({
  addons: [addonA11y(), addonDocs()],
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.body.classList.toggle(
        "opaque-mode",
        context.globals.transparency === "opaque",
      );
      document.body.classList.toggle(
        "review-reduced-motion",
        context.globals.motion === "reduced",
      );
      return (
        <main className="review-stage">
          <Story />
        </main>
      );
    },
  ],
  globalTypes: {
    motion: { toolbar: { icon: "play", items: ["normal", "reduced"] } },
    theme: { toolbar: { icon: "circlehollow", items: ["light", "dark"] } },
    transparency: { toolbar: { icon: "mirror", items: ["glass", "opaque"] } },
  },
  initialGlobals: { motion: "normal", theme: "light", transparency: "glass" },
  parameters: {
    a11y: { test: "error" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
    viewport: {
      options: {
        desktop: {
          name: "Desktop 1440 × 1000",
          styles: { height: "1000px", width: "1440px" },
        },
        mobile: {
          name: "Mobile 390 × 844",
          styles: { height: "844px", width: "390px" },
        },
        tablet: {
          name: "Tablet 834 × 1112",
          styles: { height: "1112px", width: "834px" },
        },
      },
    },
  },
  tags: ["autodocs"],
});
