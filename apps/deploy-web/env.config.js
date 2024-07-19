const { z } = require("zod");

const envSchema = z.object({
  NEXT_PUBLIC_MASTER_WALLET_ADDRESS: z.string()
});

module.exports.envSchema = envSchema;
module.exports.envConfig = envSchema.parse({
  NEXT_PUBLIC_MASTER_WALLET_ADDRESS: process.env.NEXT_PUBLIC_MASTER_WALLET_ADDRESS
});
