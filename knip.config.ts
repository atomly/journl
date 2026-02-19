import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreDependencies: [
    "@standard-community/standard-json",
    "@standard-community/standard-openapi",
    "@types/json-schema",
    "openapi-types",
    "quansync",
    "@better-auth/utils",
    "better-call",
    "@blocknote/mantine",
    "@blocknote/react",
    "@tiptap/extensions",
  ],
  ignoreUnresolved: [/\.\.\/\.\.\/\*\*\/\*\.\{js,ts,jsx,tsx\}/],
};

export default config;
