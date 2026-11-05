import { authEnv } from "@acme/auth/env";
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

const DEFAULT_WORKFLOW_DATA_DIR = ".workflow-data";

export const env = createEnv({
  client: {},
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
  extends: [authEnv(), vercel()],
  server: {
    CRON_SECRET: z.string().min(16).optional(),
    OPENAI_API_KEY: z.string(),
    OPENAI_API_URL: z.string().url().default("https://api.openai.com/v1/"),
    POSTGRES_URL: z.string().url(),
    PUBLIC_WEB_URL: z.string().url(),
    WORKFLOW_LOCAL_DATA_DIR: z.string().optional(),
    WORKFLOW_TARGET_WORLD: z.string().optional(),
  },
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});

export function parseAuthDevOrigins(value?: string): Array<string> {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => Boolean(origin));
}

export function parseNextDevOrigins(value?: string): Array<string> {
  return [
    ...new Set(
      parseAuthDevOrigins(value).map((origin) => new URL(origin).hostname),
    ),
  ];
}

/**
 * Configure Workflow before initializing the Next.js integration.
 * Keep local state outside .next and preserve history across Worlds.
 *
 * @returns The directory to prepare for local Workflow storage.
 */
export function loadWorkflowEnvironmentVariables(): string {
  const isLocalWorkflow =
    !env.VERCEL_DEPLOYMENT_ID &&
    (!env.WORKFLOW_TARGET_WORLD || env.WORKFLOW_TARGET_WORLD === "local");

  if (isLocalWorkflow) {
    process.env.WORKFLOW_TARGET_WORLD = "local";
    process.env.WORKFLOW_LOCAL_DATA_DIR ??= DEFAULT_WORKFLOW_DATA_DIR;
  }

  return isLocalWorkflow
    ? (env.WORKFLOW_LOCAL_DATA_DIR ?? DEFAULT_WORKFLOW_DATA_DIR)
    : DEFAULT_WORKFLOW_DATA_DIR;
}
