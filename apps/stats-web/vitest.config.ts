import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/": path.resolve("./src") + "/"
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"]
  }
});
