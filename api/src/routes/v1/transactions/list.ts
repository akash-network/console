import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getTransactions } from "@src/db/transactionsProvider";

const defaultLimit = 20;

const route = createRoute({
  method: "get",
  path: "/transactions",
  summary: "Get a list of transactions.",
  tags: ["Transactions"],
  request: {
    query: z.object({
      limit: z.string().openapi({
        param: { name: "limit", in: "query" },
        type: "number",
        minimum: 1,
        maximum: 100,
        description: "Number of transactions to return",
        example: defaultLimit.toString(),
        default: defaultLimit.toString()
      })
    })
  },
  responses: {
    200: {
      description: "Returns transaction list",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              height: z.number(),
              datetime: z.string(),
              hash: z.string(),
              isSuccess: z.boolean(),
              error: z.string().nullable(),
              gasUsed: z.number(),
              gasWanted: z.number(),
              fee: z.number(),
              memo: z.string(),
              messages: z.array(
                z.object({
                  id: z.string(),
                  type: z.string(),
                  amount: z.number()
                })
              )
            })
          )
        }
      }
    },
    400: {
      description: "Invalid limit",
      content: {
        "application/json": {
          schema: z.object({
            param: z.string().openapi({
              example: "limit"
            }),
            error: z.string().openapi({
              example: "Invalid limit."
            })
          })
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const limit = parseInt(c.req.query("limit"));

  if (isNaN(limit)) {
    return c.json({ param: "limit", error: "Invalid limit." }, 400);
  }

  const transactions = await getTransactions(limit || defaultLimit);

  return c.json(transactions);
});
