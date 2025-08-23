import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export function authEnv() {
  return createEnv({
    experimental__runtimeEnv: {},
    server: {
      AUTH_DISCORD_ID: z.string().min(1),
      AUTH_DISCORD_SECRET: z.string().min(1),
      AUTH_GITHUB_ID: z.string().min(1),
      AUTH_GITHUB_SECRET: z.string().min(1),
      AUTH_GOOGLE_ID: z.string().min(1),
      AUTH_GOOGLE_SECRET: z.string().min(1),
      AUTH_SECRET:
        process.env.NODE_ENV === "production"
          ? z.string().min(1)
          : z.string().min(1).optional(),
      NODE_ENV: z.enum(["development", "production"]).optional(),
    },
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}
