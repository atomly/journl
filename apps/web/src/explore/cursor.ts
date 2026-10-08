import { z } from "zod/v4";

const cursorSchema = z.object({
  after: z.string().min(1).max(2100),
  date: z
    .string()
    .refine((value) => Number.isFinite(Date.parse(value)))
    .optional(),
  owner: z.string(),
  scope: z.string(),
  snapshot: z.uuid().nullable(),
});
export type ExploreCursor = z.infer<typeof cursorSchema>;
export function encodeExploreCursor(cursor: ExploreCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}
export function decodeExploreCursor(
  value: string | undefined,
  owner: string,
  scope: string,
) {
  if (!value) return undefined;
  try {
    const parsed = cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    if (parsed.owner !== owner || parsed.scope !== scope)
      throw new Error("scope");
    if (scope.startsWith("clusters:") || scope.startsWith("recent:")) {
      if (!parsed.date) throw new Error("Missing date");
    }
    if (!scope.startsWith("sources:")) z.uuid().parse(parsed.after);
    if (!scope.startsWith("recent:") && !parsed.snapshot)
      throw new Error("Missing snapshot");
    return parsed;
  } catch {
    throw new Error("Invalid exploration cursor");
  }
}
