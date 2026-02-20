import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const config: NextConfig = {
  /** BlockNote is not yet compatible with React 19 / Next 15 StrictMode. Disabling for now. */
  reactStrictMode: false,
  /** These packages won't be bundled in the server build */
  /** @see https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages */
  serverExternalPackages: [
    "@mastra/*",
    "@blocknote/server-util",
    "better-auth",
  ],
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: ["@acme/auth", "@acme/db"],
  typescript: { ignoreBuildErrors: true },
};

export default withWorkflow(config);
