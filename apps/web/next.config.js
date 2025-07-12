import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
	/** We already do linting and typechecking as separate tasks in CI */
	eslint: { ignoreDuringBuilds: true },
	// /** These packages won't be bundled in the server build */
	// serverExternalPackages: ["@acme/ai"],
	/** Enables hot reloading for local packages without a build step */
	transpilePackages: ["@acme/ai", "@acme/api", "@acme/auth", "@acme/db"],
	typescript: { ignoreBuildErrors: true },
};

export default config;
