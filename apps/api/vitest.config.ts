import path from "path";
import swc, { type Options } from "unplugin-swc";
import { defineConfig } from "vitest/config";

import { localConfig } from "./test/services/local.config";
import tsconfig from "./tsconfig.build.json";

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
          // Critical for Sequelize decorators
          useDefineForClassFields: tsconfig.compilerOptions.useDefineForClassFields
        },
        parser: {
          syntax: "typescript",
          decorators: true
        },
        target: tsconfig.compilerOptions.target as Exclude<Options["jsc"], undefined>["target"]
      }
    })
  ],
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "./src"),
      "@test": path.resolve(__dirname, "./test")
    }
  },
  test: {
    environment: "node",
    globals: true,
    outputFile: {
      junit: "junit.xml"
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.spec.ts",
        "src/**/*.integration.ts",
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/*/routes/**/*.ts",
        "src/*/routers/**/*.ts",
        "src/routers/**/*.ts",
        "src/server.ts",
        "src/background-jobs-app.ts",
        "src/bootstrap-entry.ts",
        "src/console.ts",
        "src/core/providers/postgres.provider.ts",
        "test/**/*"
      ],
      reportsDirectory: "./coverage"
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.spec.ts"],
          setupFiles: ["./test/vitest-jest-compat.ts", "./test/setup-unit-env.ts", "./test/setup-unit-tests.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.integration.ts"],
          setupFiles: ["./test/vitest-jest-compat.ts", "./test/setup-integration-env.ts", "./test/setup-integration-tests.ts"],
          testTimeout: 60_000,
          hookTimeout: 30_000
        }
      },
      {
        extends: true,
        test: {
          name: "functional",
          include: ["test/functional/**/*.spec.ts"],
          setupFiles: ["./test/vitest-jest-compat.ts", "./test/setup-functional-env.ts", "./test/setup-functional-tests.ts"],
          testTimeout: 60_000,
          hookTimeout: 30_000,
          pool: "threads",
          maxWorkers: localConfig.FUNDING_WALLET_MNEMONIC ? 1 : undefined
        }
      },
      {
        extends: true,
        test: {
          name: "e2e",
          include: ["test/e2e/**/*.spec.ts"],
          setupFiles: ["./test/vitest-jest-compat.ts", "./test/setup-e2e-env.ts"]
        }
      }
    ]
  }
});
