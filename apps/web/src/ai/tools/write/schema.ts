import { z } from "zod";

export const zWriteInput = z.strictObject({
  agentPrompt: z
    .string()
    .describe(
      "Instructions for the writing agent that will manipulate the editor. Use a direct imperative command (not a question), avoid assistant/app sign-offs unless explicitly requested.",
    ),
});

export type WriteInput = z.infer<typeof zWriteInput>;

export const zWriteOutput = z.object({
  status: z.enum([
    "idle",
    "prepared",
    "generating",
    "applied",
    "conflict",
    "cancelled",
    "error",
  ]),
  message: z.string(),
});
