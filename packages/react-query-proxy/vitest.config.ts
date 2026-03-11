import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "react-query-proxy",
    include: ["**/src/**/*.spec.ts"],
    environment: "node"
  }
});
