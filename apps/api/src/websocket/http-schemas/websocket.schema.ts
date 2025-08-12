import { netConfig, type SupportedChainNetworks } from "@akashnetwork/net";
import { z } from "zod";

import { isValidBech32Address } from "@src/utils/addresses";

const chainNetworkSchema = z.enum(netConfig.getSupportedNetworks() as [SupportedChainNetworks]).describe("Blockchain network");

export const providerRequestSchema = z.object({
  url: z.string().url(),
  providerAddress: z.string().refine(isValidBech32Address, "is not bech32 address").describe("Bech32 representation of provider wallet address")
});

export const MESSAGE_SCHEMA = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ping")
  }),
  providerRequestSchema.extend({
    type: z.literal("websocket"),
    chainNetwork: chainNetworkSchema,
    data: z
      .string()
      .optional()
      .describe(
        "Currently it's used only for service shell communication and stores only buffered representation of string in char codes something like this: Array.from(Uint8Array).join(', ')"
      )
  })
]);

export type WsMessage = z.infer<typeof MESSAGE_SCHEMA> & { id: unknown };
