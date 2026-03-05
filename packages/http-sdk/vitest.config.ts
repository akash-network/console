import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "http-sdk",
    include: ["./src/**/*.spec.ts"],
    environment: "node"
  }
});
