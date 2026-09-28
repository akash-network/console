import path from "path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  /** unplugin-swc turns Vite's TypeScript transform off with `esbuild: false`, which Vite 8 ignores, so Oxc would transpile every file SWC already did. */
  oxc: false,
  plugins: [
    swc.vite({
      jsc: {
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true
        },
        parser: {
          syntax: "typescript",
          decorators: true
        },
        target: "es2022"
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
    globals: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.spec.ts",
        "src/**/*.d.ts",
        "src/main.ts",
        "src/test/**/*",
        "src/**/index.ts",
        "src/**/*.module.ts",
        "src/**/*.config.ts",
        "src/modules/notifications/providers/novu.provider.ts"
      ],
      reportsDirectory: "./coverage"
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.spec.ts"],
          setupFiles: ["./test/setup-env.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "functional",
          include: ["test/functional/**/*.spec.ts"],
          setupFiles: ["./test/setup-env.ts", "./test/setup-functional-tests.ts"],
          testTimeout: 60_000,
          hookTimeout: 30_000
        }
      }
    ]
  }
});
