import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    outputFile: {
      junit: "junit.xml"
    },
    coverage: {
      include: ["src/**/*.{js,ts,tsx}"]
    },
    pool: "threads",
    environment: "jsdom",
    include: ["src/**/*.spec.{tsx,ts}"],
    setupFiles: ["tests/unit/setup.ts"],
    passWithNoTests: true
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
