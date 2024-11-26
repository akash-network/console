import "@akashnetwork/env-loader";

import { defineConfig } from "drizzle-kit";

import { config } from "./src/core/config";

export default defineConfig({
  schema: ["./src/billing/model-schemas", "./src/user/model-schemas"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: config.POSTGRES_DB_URI
  }
});
