import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "drizzle-ability",
    include: ["**/src/**/*.spec.ts"],
    environment: "node"
  }
});
