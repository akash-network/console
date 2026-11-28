import { applyDefaults, copyDrizzlePlugin } from "@akashnetwork/dev-config/tsup-plugins.ts";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

import packageJson from "./package.json";
import tsconfig from "./tsconfig.json";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig(async overrideOptions =>
  applyDefaults({
    packageJson,
    prependEffectsToEntries: ["reflect-metadata", "@akashnetwork/env-loader"],
    entry: {
      server: "./src/server.ts",
      "db-migrate": "./script/db-migrate.ts",
      "funding-freeze": "./script/funding-freeze.ts",
      instrumentation: fileURLToPath(import.meta.resolve("@akashnetwork/instrumentation/register"))
    },
    target: tsconfig.compilerOptions.target,
    tsconfig: "tsconfig.build.json",
    external: ["pino-pretty"],
    plugins: [...(isProduction ? [copyDrizzlePlugin] : [])],
    onSuccess: overrideOptions.watch && !isProduction ? "npm run prod" : undefined,
    ...overrideOptions
  })
);
