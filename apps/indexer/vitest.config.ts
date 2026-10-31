import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "./src")
    }
  },
  test: {
    environment: "node",
    env: {
      AKASH_DATABASE_CS: "postgres://localhost:5432/indexer-unit-tests-never-connected"
    },
    globals: false,
    include: ["src/**/*.spec.ts"]
  }
});
