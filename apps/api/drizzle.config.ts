import "@akashnetwork/env-loader";

import { defineConfig } from "drizzle-kit";

import { config } from "./src/core/config";

export default defineConfig({
  schema: ["billing", "user", "deployment"].map(schema => `./src/${schema}/model-schemas`),
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: config.POSTGRES_DB_URI
  },
  migrations: {
    prefix: "timestamp"
  }
});
