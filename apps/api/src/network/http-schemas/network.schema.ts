import { z } from "@hono/zod-openapi";

export const GetNodesParamsSchema = z.object({
  network: z.enum(["mainnet", "testnet", "sandbox"])
});

export const NodeSchema = z.object({
  id: z.string(),
  api: z.string(),
  rpc: z.string()
});

export const GetNodesResponseSchema = z.array(NodeSchema);

export type GetNodesParams = z.infer<typeof GetNodesParamsSchema>;
export type NetworkNode = z.infer<typeof NodeSchema>;
export type GetNodesResponse = z.infer<typeof GetNodesResponseSchema>;
