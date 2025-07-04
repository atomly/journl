import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url);

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
	/** We already do linting and typechecking as separate tasks in CI */
	eslint: { ignoreDuringBuilds: true },
	/** Enables hot reloading for local packages without a build step */
	transpilePackages: ["@acme/api", "@acme/auth", "@acme/db", "@acme/ui"],
	typescript: { ignoreBuildErrors: true },
	webpack: (config) => {
		// Add path mapping for UI package's ~ui/ alias
		config.resolve.alias = {
			...config.resolve.alias,
			"~ui": path.resolve(__dirname, "../../packages/ui/src"),
		};
		return config;
	},
};

export default config;
