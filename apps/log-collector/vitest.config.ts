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
    testTimeout: 10_000,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts", "src/**/*.d.ts", "src/providers/**/*", "src/index.ts"],
      reportsDirectory: "./coverage"
    },
    reporters: ["default", "junit"],
    outputFile: { junit: "junit.xml" },
    include: ["src/**/*.spec.ts"]
  }
});
