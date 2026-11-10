import { z } from "zod/v4";
export const zResearchFindings = z.strictObject({
  findings: z.string().min(1).max(8000),
  sources: z
    .array(
      z.strictObject({ url: z.url().max(2048), title: z.string().max(256) }),
    )
    .max(6),
});
