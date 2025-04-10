import "@akashnetwork/env-loader";

import { defineConfig } from "drizzle-kit";
import * as process from "node:process";
import { z } from "zod";

const env = z.object({
  NOTIFICATIONS_POSTGRES_URL: z.string()
}).parse(process.env)

export default defineConfig({
  schema: "./src/*/model-schemas",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.NOTIFICATIONS_POSTGRES_URL
  }
});
