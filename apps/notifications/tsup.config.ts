import { applyDefaults, copyDrizzlePlugin } from "@akashnetwork/dev-config/tsup-plugins.ts";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { join } from "node:path";
import { defineConfig, type Options } from "tsup";

import packageJson from "./package.json";
import tsconfig from "./tsconfig.build.json";

type Plugin = Required<Options>["plugins"][number];

const copyDrizzleConfigPlugin: Plugin = {
  name: "copy-drizzle-config",
  async buildEnd() {
    const src = "drizzle.config.js";
    const dest = join("dist", "drizzle", "drizzle.config.js");

    if (!existsSync(src)) {
      throw new Error(`${src} is required for migration:exec:prod`);
    }

    await fs.mkdir(join("dist", "drizzle"), { recursive: true });
    await fs.copyFile(src, dest);
  }
};

export default defineConfig(async overrideOptions =>
  applyDefaults({
    packageJson,
    prependEffectsToEntries: ["reflect-metadata", "@akashnetwork/env-loader"],
    entry: ["./src/main.ts"],
    target: tsconfig.compilerOptions.target,
    tsconfig: "tsconfig.build.json",
    dts: false,
    plugins: [copyDrizzlePlugin, copyDrizzleConfigPlugin],
    swc: {
      jsc: {
        transform: {
          decoratorMetadata: true
        }
      }
    } as Options["swc"],
    onSuccess: overrideOptions.watch ? "node --enable-source-maps dist/main.js" : undefined,
    ...overrideOptions
  })
);
