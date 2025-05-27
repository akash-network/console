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
      .default("true")
  })
  .parse(process.env);

const config = {
  dialect: "postgresql",
  dbCredentials: {
    url: env.NOTIFICATIONS_POSTGRES_URL
  }
};

if (env.INCLUDE_SCHEMAS) {
  config.schema = "./src/modules/*/model-schemas";
  config.out = "./drizzle";
}

module.exports = defineConfig(config);
