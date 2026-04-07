import path from "path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
