const { z } = require("zod");

const envSchema = z.object({
  NEXT_PUBLIC_MASTER_WALLET_ADDRESS: z.string().optional(),
  NEXT_PUBLIC_BILLING_ENABLED: z
    .enum(["true", "false"])
    .transform(val => val === "true")
    .optional()
    .default("false")
});

module.exports.envSchema = envSchema;
module.exports.envConfig = envSchema.parse({
  NEXT_PUBLIC_MASTER_WALLET_ADDRESS: process.env.NEXT_PUBLIC_MASTER_WALLET_ADDRESS,
  NEXT_PUBLIC_BILLING_ENABLED: process.env.NEXT_PUBLIC_BILLING_ENABLED
});
