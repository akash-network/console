import "@akashnetwork/env-loader";

import { defineConfig } from "drizzle-kit";
import * as process from "node:process";
import { z } from "zod";

const env = z
  .object({
    POSTGRES_URL: z.string()
  })
  .parse(process.env);

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.POSTGRES_URL
  }
});
