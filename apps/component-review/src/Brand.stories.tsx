import { Brand } from "../../web/src/components/brand";
import preview from "../.storybook/preview";

const meta = preview.meta({
  component: Brand,
  parameters: {
    docs: {
      description: {
        component:
          "Exact assets/brand/lockup-light.svg and lockup-dark.svg; forced-colors uses the owning Brand component's CanvasText mask. Canonical anchors: buttons, forced-colors; approved-brand.md. No artwork copied into the review workspace.",
      },
    },
  },
  tags: ["ai-generated"],
});
export const Light = meta.story({ globals: { theme: "light" } });
export const Dark = meta.story({ globals: { theme: "dark" } });
export const MarketingSize = meta.story({ args: { className: "h-8" } });
