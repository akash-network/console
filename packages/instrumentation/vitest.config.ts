import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "logging",
    include: ["**/src/**/*.spec.ts"],
    environment: "node"
  }
});
