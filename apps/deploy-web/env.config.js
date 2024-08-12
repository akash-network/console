const { z } = require("zod");

const networkId = z.enum(["mainnet", "sandbox", "testnet"]);

const envSchema = z.object({
  NEXT_PUBLIC_MASTER_WALLET_ADDRESS: z.string().optional(),
  NEXT_PUBLIC_BILLING_ENABLED: z
    .enum(["true", "false"])
    .transform(val => val === "true")
    .optional()
    .default("false"),
  NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID: networkId.optional().default("mainnet"),
  NEXT_PUBLIC_DEFAULT_NETWORK_ID: networkId.optional().default("mainnet"),
  DEFAULT_NETWORK_ID: networkId.optional().default("mainnet")
});

module.exports.envSchema = envSchema;
module.exports.envConfig = envSchema.parse({
  NEXT_PUBLIC_MASTER_WALLET_ADDRESS: process.env.NEXT_PUBLIC_MASTER_WALLET_ADDRESS,
  NEXT_PUBLIC_BILLING_ENABLED: process.env.NEXT_PUBLIC_BILLING_ENABLED,
  NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID: process.env.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID,
  NEXT_PUBLIC_DEFAULT_NETWORK_ID: process.env.NEXT_PUBLIC_DEFAULT_NETWORK_ID,
  DEFAULT_NETWORK_ID: process.env.DEFAULT_NETWORK_ID
});
