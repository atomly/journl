import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export function dbEnv() {
  return createEnv({
    experimental__runtimeEnv: {},
    server: {
      POSTGRES_URL: z.url(),
    },
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}
