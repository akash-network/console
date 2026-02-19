import "@akashnetwork/env-loader";

import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

const commonAlias: Record<string, string> = {
  "@src": path.resolve("./src"),
  "@tests": path.resolve("./tests"),
  // see ./src/lib/auth0/setSession/setSession.ts for more details
  "@auth0/nextjs-auth0/session": path.join(require.resolve("@auth0/nextjs-auth0"), "..", "session", "index.js"),
  "@auth0/nextjs-auth0/update-session": path.join(require.resolve("@auth0/nextjs-auth0"), "..", "session", "update-session.js")
};

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.{js,ts,tsx}"],
      exclude: ["src/**/Editor/monaco-*.ts", "src/**/Editor/*.worker.ts"]
    },
    pool: "threads",
    projects: [
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "unit",
          environment: "jsdom",
          isolate: false,
          include: ["src/**/*.spec.{tsx,ts}"],
          exclude: ["**/node_modules/**", "src/lib/nextjs/**", "src/lib/auth0/**"],
          setupFiles: ["tests/unit/setup.ts"]
        },
        resolve: {
          alias: {
            ...commonAlias,
            "@interchain-ui/react/styles": path.resolve("./tests/unit/__mocks__/style.ts"),
            "@interchain-ui/react/globalStyles": path.resolve("./tests/unit/__mocks__/style.ts")
          }
        }
      },
      {
        extends: true,
        test: {
          name: "unit-node",
          environment: "node",
          include: ["src/lib/{nextjs,auth0}/**/*.spec.{tsx,ts}"],
          setupFiles: ["src/lib/nextjs/setup-node-tests.ts"]
        },
        resolve: {
          alias: {
            ...commonAlias
          }
        }
      }
    ]
  }
});
