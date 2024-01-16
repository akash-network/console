import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getBlocks } from "@src/db/blocksProvider";

const defaultLimit = 20;

const route = createRoute({
  method: "get",
  path: "/blocks",
  summary: "Get a list of recent blocks.",
  tags: ["Blocks"],
  request: {
    query: z.object({
      limit: z.string().openapi({
        param: { name: "limit", in: "query" },
        type: "number",
        minimum: 1,
        maximum: 100,
        description: "Number of blocks to return",
        example: defaultLimit.toString(),
        default: defaultLimit.toString()
      })
    })
  },
  responses: {
    200: {
      description: "Returns block list",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              height: z.number(),
              proposer: z.object({
                address: z.string(),
                operatorAddress: z.string(),
                moniker: z.string(),
                avatarUrl: z.string()
              }),
              transactionCount: z.number(),
              totalTransactionCount: z.number(),
              datetime: z.string()
            })
          )
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const limit = parseInt(c.req.valid("query").limit?.toString());
  const blocks = await getBlocks(limit || defaultLimit);

  return c.json(blocks);
});
