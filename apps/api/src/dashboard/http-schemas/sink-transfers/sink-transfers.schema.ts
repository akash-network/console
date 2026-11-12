import { z } from "@hono/zod-openapi";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const SinkTransferStatusSchema = z.enum(["pending", "minted", "voided", "refund_pending", "refunded"]);

export type SinkTransferStatus = z.infer<typeof SinkTransferStatusSchema>;

export const SinkTransfersQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional().default(0).openapi({
    type: "number",
    minimum: 0,
    description: "Number of transfers to skip",
    example: 0,
    default: 0
  }),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT).openapi({
    type: "number",
    minimum: 1,
    maximum: MAX_LIMIT,
    description: "Number of transfers to return",
    example: DEFAULT_LIMIT,
    default: DEFAULT_LIMIT
  }),
  sort: z.enum(["latest", "largest"]).optional().default("latest").openapi({
    description: "Returns the most recent transfers first, or the largest amounts first",
    example: "latest",
    default: "latest"
  })
});

export type SinkTransfersQuery = z.infer<typeof SinkTransfersQuerySchema>;

export const SinkTransfersResponseSchema = z.object({
  count: z.number().openapi({ description: "Total number of transfers" }),
  results: z.array(
    z.object({
      owner: z.string().openapi({ description: "Akash address that sent the AKT" }),
      height: z.number().openapi({ description: "Height of the block that created the transfer" }),
      sequence: z.number().openapi({ description: "Position of the transfer among the transfers of its block" }),
      recipient: z.string().openapi({ description: "Solana address that receives the AKT" }),
      amountUakt: z.number(),
      status: SinkTransferStatusSchema,
      createdAt: z.string(),
      statusHeight: z.number().openapi({ description: "Height of the block that last changed the status" }),
      statusUpdatedAt: z.string()
    })
  )
});

export type SinkTransfersResponse = z.infer<typeof SinkTransfersResponseSchema>;
