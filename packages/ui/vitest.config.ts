import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "ui",
    include: ["**/*.spec.tsx"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest-setup.ts"],
    css: {
      modules: {
        classNameStrategy: "non-scoped"
      }
    }
  }
});
