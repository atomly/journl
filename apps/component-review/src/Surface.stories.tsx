import { Button } from "@acme/ui/button";
import { Surface } from "@acme/ui/surface";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: {
    children: (
      <>
        <h2 className="font-semibold text-2xl">Readable material</h2>
        <p>
          Reading content stays opaque. Glass is reserved for functional chrome.
        </p>
        <Button variant="outline">Search notebook</Button>
      </>
    ),
    className: "review-stack p-6",
  },
  component: Surface,
  parameters: {
    docs: {
      description: {
        component:
          "Canonical states: transparency-reduced, focus-ring, forced-colors. Ambient background and values are imported from Journl's owned stylesheet. No copied palette.",
      },
    },
  },
  tags: ["ai-generated"],
});
export const Paper = meta.story({ args: { material: "paper" } });
export const Solid = meta.story({ args: { material: "solid" } });
export const Glass = meta.story({ args: { material: "glass" } });
export const Opaque = meta.story({
  args: { material: "glass" },
  globals: { transparency: "opaque" },
});
export const ReducedMotion = meta.story({
  args: { material: "glass" },
  globals: { motion: "reduced" },
});
export const DarkGlass = Glass.extend({ globals: { theme: "dark" } });
export const DarkOpaque = Opaque.extend({
  globals: { theme: "dark", transparency: "opaque" },
});
