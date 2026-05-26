import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "openapi-sdk",
    include: ["**/src/**/*.spec.ts"],
    environment: "node"
  }
});
