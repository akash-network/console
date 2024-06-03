import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getTransaction } from "@src/services/db/transactionsService";
import { openApiExampleTransactionHash } from "@src/utils/constants";

const route = createRoute({
  method: "get",
  path: "/transactions/{hash}",
  summary: "Get a transaction by hash.",
  tags: ["Transactions"],
  request: {
    params: z.object({
      hash: z.string().openapi({
        description: "Transaction hash",
        example: openApiExampleTransactionHash
      })
    })
  },
  responses: {
    200: {
      description: "Returns predicted block date",
      content: {
        "application/json": {
          schema: z.object({
            height: z.number(),
            datetime: z.string(),
            hash: z.string(),
            isSuccess: z.boolean(),
            multisigThreshold: z.number().optional(),
            signers: z.array(z.string()),
            error: z.string().nullable(),
            gasUsed: z.number(),
            gasWanted: z.number(),
            fee: z.number(),
            memo: z.string(),
            messages: z.array(
              z.object({
                id: z.string(),
                type: z.string(),
                data: z.record(z.string()),
                relatedDeploymentId: z.string().optional()
              })
            )
          })
        }
      }
    },
    404: {
      description: "Transaction not found"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const txInfo = await getTransaction(c.req.valid("param").hash);

  if (txInfo) {
    return c.json(txInfo);
  } else {
    return c.text("Tx not found", 404);
  }
});
