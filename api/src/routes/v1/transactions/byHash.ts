import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getTransaction } from "@src/db/transactionsProvider";

const route = createRoute({
  method: "get",
  path: "/transactions/{hash}",
  summary: "Get a transaction by hash.",
  tags: ["Transactions"],
  request: {
    params: z.object({
      hash: z.string().openapi({
        description: "Transaction hash",
        example: "A19F1950D97E576F0D7B591D71A8D0366AA8BA0A7F3DA76F44769188644BE9EB"
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
