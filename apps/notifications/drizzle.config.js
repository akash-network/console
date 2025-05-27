require("@akashnetwork/env-loader");

const { defineConfig } = require("drizzle-kit");
const { z } = require("zod");

const env = z
  .object({
    NOTIFICATIONS_POSTGRES_URL: z.string(),
    INCLUDE_SCHEMAS: z
      .enum(["true", "false"])
      .transform(val => val === "true")
      .optional()
      .default("true"),
    DRIZZLE_MIGRATIONS_FOLDER: z.string().optional().default("./drizzle")
  })
  .parse(process.env);

const config = {
  dialect: "postgresql",
  dbCredentials: {
    url: env.NOTIFICATIONS_POSTGRES_URL
  },
  out: env.DRIZZLE_MIGRATIONS_FOLDER
};

if (env.INCLUDE_SCHEMAS) {
  config.schema = "./src/modules/*/model-schemas";
}

module.exports = defineConfig(config);
