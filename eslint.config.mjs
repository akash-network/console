// @ts-check
import path from "path";
import { fileURLToPath } from "url";

import { nextConfigs, nextParityRules } from "@akashnetwork/dev-config/eslint/next.mjs";
import tsConfig from "@akashnetwork/dev-config/eslint/typescript.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WEB_FILES = ["apps/*-web/**/*.{ts,tsx}", "apps/landing/**/*.{ts,tsx}"];

export default [
  {
    ignores: ["console-air/**", ".claude/**"]
  },
  ...tsConfig,
  ...nextConfigs.map(config => ({ ...config, files: WEB_FILES })),
  {
    files: WEB_FILES,
    settings: {
      next: { rootDir: "apps/*" },
      "import-x/ignore": ["react"]
    },
    rules: {
      ...nextParityRules,
      "@next/next/no-html-link-for-pages": ["error", ["deploy-web", "landing"].map(app => path.resolve(__dirname, `apps/${app}/src/pages`))]
    }
  }
];
