import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "net",
    include: ["**/src/**/*.spec.ts"],
    environment: "node",
    globals: true
  }
});
