import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "provider-verification",
    include: ["**/*.spec.ts"],
    environment: "node"
  }
});
