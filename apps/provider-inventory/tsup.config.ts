import { applyDefaults, copyDrizzlePlugin } from "@akashnetwork/dev-config/tsup-plugins.ts";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

import packageJson from "./package.json";
import tsconfig from "./tsconfig.build.json";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig(async overrideOptions =>
  applyDefaults({
    packageJson,
    prependEffectsToEntries: ["reflect-metadata", "@akashnetwork/env-loader"],
    entry: {
      server: "./src/server.ts",
      "rest-app": "./src/rest-app.ts",
      "providers-sync-app": "./src/providers-sync-app.ts",
      "db-migrate": "./script/db-migrate.ts",
      instrumentation: fileURLToPath(import.meta.resolve("@akashnetwork/instrumentation/register"))
    },
    target: tsconfig.compilerOptions.target,
    tsconfig: "tsconfig.build.json",
    external: ["pino-pretty"],
    dts: false,
    plugins: [...(isProduction ? [copyDrizzlePlugin] : [])],
    onSuccess: overrideOptions.watch && !isProduction ? "npm run migration:exec && NODE_OPTIONS='--allow-worker' npm run prod" : undefined,
    ...overrideOptions
  })
);
