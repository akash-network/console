import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getBlock } from "@src/db/blocksProvider";
import { getTransaction } from "@src/db/transactionsProvider";

const route = createRoute({
  method: "get",
  path: "/blocks/{height}",
  summary: "Get a block by height.",
  tags: ["Blocks"],
  request: {
    params: z.object({
      height: z.string().openapi({
        param: { name: "height", in: "path" },
        description: "Block Height",
        example: "12121212"
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
            proposer: z.object({
              operatorAddress: z.string(),
              moniker: z.string(),
              avatarUrl: z.string(),
              address: z.string()
            }),
            hash: z.string(),
            gasUsed: z.number(),
            gasWanted: z.number(),
            transactions: z.array(
              z.object({
                hash: z.string(),
                isSuccess: z.boolean(),
                error: z.string().nullable(),
                fee: z.number(),
                datetime: z.string(),
                messages: z.array(
                  z.object({
                    id: z.string(),
                    type: z.string(),
                    amount: z.number()
                  })
                )
              })
            )
          })
        }
      }
    },
    404: {
      description: "Block not found"
    },
    400: {
      description: "Invalid height"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const heightInt = parseInt(c.req.valid("param").height);

  if (isNaN(heightInt)) {
    return c.text("Invalid height.", 400);
  }

  const blockInfo = await getBlock(heightInt);

  if (blockInfo) {
    return c.json(blockInfo);
  } else {
    return c.text("Block not found", 404);
  }
});
