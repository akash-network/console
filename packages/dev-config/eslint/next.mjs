// @ts-check
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

import tsConfig from "./typescript.mjs";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/** eslint-config-next 15.x ships an eslintrc-style shareable config; FlatCompat adapts it for flat config. */
export const nextConfigs = compat.extends("next/core-web-vitals");

export const nextParitySettings = {
  next: { rootDir: "." },
  "import-x/ignore": ["react"]
};

export const nextParityRules = {
  "react/no-unescaped-entities": "warn",
  "react-hooks/exhaustive-deps": "warn",
  "import/no-anonymous-default-export": "warn",
  "react/display-name": "off"
};

export default [
  ...tsConfig,
  ...nextConfigs.map(config => ({ ...config, files: ["**/*.ts", "**/*.tsx"] })),
  {
    files: ["**/*.ts", "**/*.tsx"],
    settings: nextParitySettings,
    rules: nextParityRules
  }
];
