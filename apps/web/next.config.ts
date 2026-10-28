import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import { env, parseAuthDevOrigins } from "~/env";

const config: NextConfig = {
  /* Adding support for cross origin request in development */
  allowedDevOrigins: parseAuthDevOrigins(env.AUTH_DEV_ORIGINS),
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@acme/open-editor",
    "@acme/document",
    "@acme/references",
    "@acme/auth",
    "@acme/blocknote",
    "@acme/db",
    "@acme/graph",
    "@acme/ui",
  ],
  typescript: { ignoreBuildErrors: true },
};

export default withWorkflow(config);
