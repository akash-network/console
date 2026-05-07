import "@akashnetwork/env-loader";

import { defineConfig } from "drizzle-kit";
import { z } from "zod";

const env = z
  .object({
    PROVIDER_INVENTORY_POSTGRES_URL: z.string(),
    DRIZZLE_MIGRATIONS_FOLDER: z.string().optional().default("./drizzle")
  })
  .parse(process.env);

export default defineConfig({
  schema: "./src/model-schemas",
  out: env.DRIZZLE_MIGRATIONS_FOLDER,
  dialect: "postgresql",
  dbCredentials: {
    url: env.PROVIDER_INVENTORY_POSTGRES_URL
  }
});
