import { z } from "zod";

export const zWriteInput = z.strictObject({});

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
