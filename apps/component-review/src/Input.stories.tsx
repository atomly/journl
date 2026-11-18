import { Input } from "@acme/ui/input";
import { expect } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { defaultValue: "Sam Rivera", id: "review-input" },
  component: Input,
  decorators: [
    (Story) => (
      <label htmlFor="review-input" className="review-label review-stack">
        Name
        <Story />
      </label>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Canonical state: fields; keyboard treatment: focus-ring. Synthetic data only.",
      },
    },
  },
  tags: ["ai-generated"],
});
export const Editable = meta.story({
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Sam Example");
    await expect(input).toHaveValue("Sam Example");
  },
});
export const Disabled = meta.story({ args: { disabled: true } });
export const Invalid = meta.story({
  args: {
    "aria-describedby": "input-error",
    "aria-invalid": true,
    defaultValue: "sam@",
  },
  render: (args) => (
    <>
      <Input {...args} />
      <p id="input-error" className="text-destructive">
        Enter a complete email address.
      </p>
    </>
  ),
});
export const ReadOnly = meta.story({
  args: { readOnly: true },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("textbox");
    await userEvent.type(input, "changed");
    await expect(input).toHaveValue("Sam Rivera");
  },
});
export const LongContent = meta.story({
  args: {
    defaultValue:
      "A useful idea with a long descriptive title that remains available when the field receives focus",
  },
});
export const DarkEditable = Editable.extend({ globals: { theme: "dark" } });
export const DarkInvalid = Invalid.extend({ globals: { theme: "dark" } });
