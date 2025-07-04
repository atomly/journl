import baseConfig from "@acme/tailwind-config/web";
import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

export default {
	// We need to append the path to the UI package to the content array so that
	// those classes are included correctly.
	content: [...baseConfig.content, "../../packages/ui/src/*.{ts,tsx}"],
	presets: [baseConfig],
	theme: {
		extend: {
			fontFamily: {
				mono: ["var(--font-geist-mono)", ...fontFamily.mono],
				sans: ["var(--font-geist-sans)", ...fontFamily.sans],
			},
		},
	},
} satisfies Config;
