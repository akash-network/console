import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "instrumentation",
    include: ["**/src/**/*.spec.ts"],
    environment: "node"
  }
});
