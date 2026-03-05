import "@akashnetwork/env-loader";

import { defineConfig } from "drizzle-kit";

const { POSTGRES_DB_URI } = process.env;

if (!POSTGRES_DB_URI) {
  throw new Error("POSTGRES_DB_URI must be set");
}

export default defineConfig({
  schema: ["billing", "user", "deployment", "auth"].map(schema => `./src/${schema}/model-schemas`),
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: POSTGRES_DB_URI
  }
});
