import { applyDefaults, copyDrizzlePlugin } from "@akashnetwork/dev-config/tsup-plugins.ts";
import { defineConfig } from "tsup";

import packageJson from "./package.json";
import tsconfig from "./tsconfig.json";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig(async overrideOptions =>
  applyDefaults({
    packageJson,
    // this is to ensure that this modules are loaded before the entry point,
    // even if tsup messes up imports tree
    prependEffectsToEntries: ["reflect-metadata", "@akashnetwork/env-loader"],
    entry: ["./src/server.ts", "./src/rest-app.ts", "./src/background-jobs-app.ts", "./src/console.ts"],
    target: tsconfig.compilerOptions.target,
    tsconfig: "tsconfig.build.json",
    external: ["pino-pretty"],
    plugins: [...(isProduction ? [copyDrizzlePlugin] : [])],
    onSuccess: overrideOptions.watch && !isProduction ? "node --enable-source-maps dist/server.js" : undefined,
    ...overrideOptions
  })
);
