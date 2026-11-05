import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import {
  env,
  loadWorkflowEnvironmentVariables,
  parseNextDevOrigins,
} from "~/env";
import { prepareLocalWorkflowStorage } from "./src/workflows/local-storage";

// Preserve local Workflow history outside Next.js build artifacts.
prepareLocalWorkflowStorage(process.cwd(), loadWorkflowEnvironmentVariables());

const config: NextConfig = {
  allowedDevOrigins: parseNextDevOrigins(env.AUTH_DEV_ORIGINS),
  experimental: {
    turbopackFileSystemCacheForDev: !env.CI,
  },
  transpilePackages: [
    "@acme/better-editor",
    "@acme/document",
    "@acme/references",
    "@acme/auth",
    "@acme/blocknote",
    "@acme/db",
    "@acme/graph",
    "@acme/ui",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withWorkflow(config);
