import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const config: NextConfig = {
  /** These packages won't be bundled in the server build */
  /** @see https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages */
  serverExternalPackages: ["@blocknote/server-util"],
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: ["@acme/auth", "@acme/blocknote", "@acme/db"],
  typescript: { ignoreBuildErrors: true },
};

export default withWorkflow(config);
