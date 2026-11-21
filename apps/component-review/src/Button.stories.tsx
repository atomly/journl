import { Button, buttonVariants } from "@acme/ui/button";
import { expect, fn } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { children: "Save", onClick: fn() },
  component: Button,
  parameters: {
    docs: {
      description: {
        component:
          "Canonical states: buttons, focus-ring, forced-colors. Compare views/shared/<state>--<theme>--<device>.png. These are isolated controls, not shell acceptance.",
      },
    },
  },
  tags: ["ai-generated"],
});
export const Primary = meta.story({
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
});
export const Variants = meta.story({
  render: () => (
    <div className="review-row">
      {(
        [
          "default",
          "outline",
          "secondary",
          "ghost",
          "background",
          "link",
          "selected",
          "assistant",
          "destructive",
        ] as const
      ).map((variant) => (
        <Button
          key={variant}
          variant={variant}
          aria-pressed={variant === "selected" ? true : undefined}
        >
          {variant}
        </Button>
      ))}
    </div>
  ),
});
export const Sizes = meta.story({
  render: () => (
    <div className="review-row">
      {(
        [
          "xs",
          "sm",
          "default",
          "lg",
          "icon-xs",
          "icon-sm",
          "icon",
          "icon-lg",
        ] as const
      ).map((size) => (
        <Button key={size} size={size} aria-label={size}>
          {size.startsWith("icon") ? "+" : size}
        </Button>
      ))}
    </div>
  ),
});
export const Disabled = meta.story({
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button")).toBeDisabled();
  },
});
export const Pending = meta.story({
  args: { "aria-busy": true, children: "Saving…", disabled: true },
});
export const KeyboardFocus = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await expect(canvas.getByRole("button")).toHaveFocus();
  },
});
export const Hover = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.hover(canvas.getByRole("button"));
    await expect(canvas.getByRole("button")).toHaveTextContent("Save");
  },
});
export const NativeLink = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link")).toHaveAttribute(
      "href",
      "#reference",
    );
  },
  render: () => (
    <a href="#reference" className={buttonVariants({ variant: "link" })}>
      Open reference
    </a>
  ),
});
export const NonNativeButton = meta.story({
  args: { nativeButton: false, render: <span /> },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole("button");
    button.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
});
export const CssCheck = meta.story({
  play: async ({ canvas }) => {
    await expect(
      getComputedStyle(canvas.getByRole("button")).backgroundColor,
    ).toBe("rgb(160, 229, 205)");
    await expect(getComputedStyle(canvas.getByRole("button")).height).toBe(
      "44px",
    );
  },
});
export const DarkVariants = Variants.extend({ globals: { theme: "dark" } });
