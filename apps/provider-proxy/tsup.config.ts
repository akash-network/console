import { applyDefaults } from "@akashnetwork/dev-config/tsup-plugins.ts";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

import packageJson from "./package.json";
import tsconfig from "./tsconfig.build.json";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig(async overrideOptions =>
  applyDefaults({
    packageJson,
    // this is to ensure that this modules are loaded before the entry point,
    // even if tsup messes up imports tree
    prependEffectsToEntries: ["@akashnetwork/env-loader"],
    entry: {
      server: "./src/server.ts",
      instrumentation: fileURLToPath(import.meta.resolve("@akashnetwork/instrumentation/register"))
    },
    target: tsconfig.compilerOptions.target,
    tsconfig: "tsconfig.build.json",
    external: ["pino-pretty"],
    dts: false,
    onSuccess: overrideOptions.watch && !isProduction ? "node --enable-source-maps dist/server.js" : undefined,
    ...overrideOptions
  })
);
