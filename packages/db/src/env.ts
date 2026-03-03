import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export function dbEnv() {
  return createEnv({
    experimental__runtimeEnv: {},
    server: {
      POSTGRES_SSL_MODE: z.enum(["auto", "require", "disable"]).default("auto"),
      POSTGRES_URL: z.url(),
    },
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}
