import { Textarea } from "@acme/ui/textarea";
import { expect } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { defaultValue: "Keep useful ideas together.", id: "review-textarea" },
  component: Textarea,
  decorators: [
    (Story) => (
      <label htmlFor="review-textarea" className="review-label review-stack">
        Notes
        <Story />
      </label>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Canonical state: fields. Authored copy wraps; read-only retains selection and copying.",
      },
    },
  },
  tags: ["ai-generated"],
});
export const Editable = meta.story({
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "An idea worth keeping.");
    await expect(input).toHaveValue("An idea worth keeping.");
  },
});
export const Disabled = meta.story({ args: { disabled: true } });
export const Invalid = meta.story({
  args: { "aria-describedby": "notes-error", "aria-invalid": true },
  render: (args) => (
    <>
      <Textarea {...args} />
      <p id="notes-error" className="text-destructive">
        Describe the idea before saving.
      </p>
    </>
  ),
});
export const ReadOnly = meta.story({ args: { readOnly: true } });
export const LongContent = meta.story({
  args: {
    defaultValue: Array(8)
      .fill(
        "A project, a recipe, a reference. Keep the original details close to the idea.",
      )
      .join("\n"),
  },
});
export const DarkEditable = Editable.extend({ globals: { theme: "dark" } });
