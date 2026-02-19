import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
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
  transpilePackages: ["@acme/api", "@acme/auth", "@acme/db"],
  typescript: { ignoreBuildErrors: true },
};

export default config;
