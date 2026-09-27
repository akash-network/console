import path from "path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  /** unplugin-swc turns Vite's TypeScript transform off with `esbuild: false`, which Vite 8 ignores, so Oxc would transpile every file SWC already did. */
  oxc: false,
  plugins: [swc.vite()],
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "./src"),
      "@test": path.resolve(__dirname, "./test")
    }
  },
  test: {
    environment: "node",
    globals: true,
    testTimeout: 120_000,
    hookTimeout: 60_000,
    include: ["test/e2e/**/*.e2e.ts"]
  }
});
