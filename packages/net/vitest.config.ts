import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "net",
    include: ["**/*.spec.ts"],
    environment: "node"
  }
});
