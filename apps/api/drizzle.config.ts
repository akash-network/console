import { defineConfig } from "drizzle-kit";

import { env } from "./src/utils/env";

export default defineConfig({
  schema: "./src/billing/model-schemas",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.UserDatabaseCS
  }
});
