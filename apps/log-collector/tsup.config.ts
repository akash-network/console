import { applyDefaults } from "@akashnetwork/dev-config/tsup-plugins.ts";
import { defineConfig } from "tsup";

import packageJson from "./package.json";
import tsconfig from "./tsconfig.build.json";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig(async overrideOptions =>
  applyDefaults({
    packageJson,
    prependEffectsToEntries: ["reflect-metadata", "@akashnetwork/env-loader"],
    entry: ["./src/index.ts"],
    target: tsconfig.compilerOptions.target,
    tsconfig: "tsconfig.build.json",
    onSuccess: overrideOptions.watch && !isProduction ? "node --enable-source-maps dist/index.js" : undefined,
    ...overrideOptions
  })
);
