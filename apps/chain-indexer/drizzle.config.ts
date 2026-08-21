import "@akashnetwork/env-loader";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_DB_URI ?? "postgres://offline:offline@localhost:5432/offline"
  }
});
