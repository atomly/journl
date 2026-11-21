import { Button } from "@acme/ui/button";
import { Surface } from "@acme/ui/surface";
import preview from "../.storybook/preview";

const meta = preview.meta({
  component: Surface,
  parameters: {
    docs: {
      description: {
        component:
          "Role specimens from Journl's live theme, not an alternate application view. Canonical anchors: buttons, fields, focus-ring, transparency-reduced, forced-colors. Full route comparison belongs to later stack layers.",
      },
    },
  },
  tags: ["ai-generated"],
});
export const SemanticColors = meta.story({
  render: () => (
    <div className="review-stack">
      <h1 className="font-semibold text-3xl">Semantic color roles</h1>
      {[
        ["Action", "bg-primary text-primary-foreground"],
        ["Selected", "bg-accent text-accent-foreground"],
        ["Reference", "bg-reference text-pastel-foreground"],
        ["Assistant", "bg-assistant text-pastel-foreground"],
        ["Feedback", "bg-feedback text-pastel-foreground"],
        ["Reading", "bg-card text-card-foreground"],
      ].map(([name, classes]) => (
        <div key={name} className={`review-chip ${classes}`}>
          {name}
        </div>
      ))}
      <Button disabled>Disabled control</Button>
    </div>
  ),
});
export const Typography = meta.story({
  render: () => (
    <Surface className="review-stack p-6">
      <h1 className="font-semibold text-[44px] leading-[1.12]">
        Useful knowledge
      </h1>
      <h2 className="font-semibold text-[32px] leading-[1.2]">
        A place to return to
      </h2>
      <p className="text-[18px] leading-[1.7]">
        Reading text gives an idea room to breathe. Inter is served locally from
        the approved source file.
      </p>
      <p className="font-medium text-[15px] leading-6">Control label · 500</p>
      <p className="text-[13px] text-muted-foreground leading-[1.6]">
        Metadata · 400
      </p>
    </Surface>
  ),
});
export const Spacing = meta.story({
  render: () => (
    <Surface className="review-stack p-6">
      <h1 className="font-semibold text-2xl">Spacing scale</h1>
      {[4, 8, 12, 16, 24, 32, 48, 64].map((size) => (
        <div key={size} className="review-row">
          <span>{size}px</span>
          <span className="bg-accent" style={{ height: 16, width: size }} />
        </div>
      ))}
    </Surface>
  ),
});
export const DarkSemanticColors = SemanticColors.extend({
  globals: { theme: "dark" },
});
