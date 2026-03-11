import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "./src"),
      "@test": path.resolve(__dirname, "./test")
    }
  },
  test: {
    environment: "node",
    globals: false,
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts", "src/**/*.d.ts", "src/**/index.ts"],
      reportsDirectory: "./coverage"
    },
    reporters: ["default", "junit"],
    outputFile: { junit: "junit.xml" },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.spec.ts"],
          setupFiles: ["./test/setup-unit-env.ts", "./test/setup-unit-tests.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "functional",
          include: ["test/functional/**/*.spec.ts"],
          setupFiles: ["./test/setup-functional-env.ts", "./test/setup-unit-tests.ts"]
        }
      }
    ]
  }
});
