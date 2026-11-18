import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineMain } from "@storybook/react-vite/node";

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that are set up within a monorepo.
 */
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
export default defineMain({
  addons: [
    getAbsolutePath("@storybook/addon-vitest"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
  ],
  framework: getAbsolutePath("@storybook/react-vite"),
  staticDirs: [
    { from: "../../web/public/brand", to: "/brand" },
    { from: "../../web/src/app/fonts", to: "/fonts" },
  ],
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
});
