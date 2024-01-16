import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getTransactionByAddress } from "@src/db/transactionsProvider";
import { isValidBech32Address } from "@src/utils/addresses";
import { openApiExampleAddress } from "@src/utils/constants";

const route = createRoute({
  method: "get",
  path: "/addresses/{address}/transactions/{skip}/{limit}",
  summary: "Get a list of transactions for a given address.",
  tags: ["Addresses", "Transactions"],
  request: {
    params: z.object({
      address: z.string().openapi({
        description: "Wallet Address",
        example: openApiExampleAddress
      }),
      skip: z.string().openapi({
        description: "Transactions to skip",
        example: "10"
      }),
      limit: z.string().openapi({
        description: "Transactions to return",
        example: "10"
      })
    })
  },
  responses: {
    200: {
      description: "Returns transaction list",
      content: {
        "application/json": {
          schema: z.object({
            count: z.number(),
            results: z.array(
              z.object({
                height: z.number(),
                datetime: z.string(),
                hash: z.string(),
                isSuccess: z.boolean(),
                error: z.string().nullable(),
                gasUsed: z.number(),
                gasWanted: z.number(),
                fee: z.number(), // TODO CHECK
                memo: z.string().nullable(),
                isSigner: z.boolean(),
                messages: z.array(
                  z.object({
                    id: z.number(),
                    type: z.string(),
                    amount: z.number(),
                    isReceiver: z.boolean()
                  })
                )
              })
            )
          })
        }
      }
    },
    400: {
      description: "Invalid address"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  if (!isValidBech32Address(c.req.valid("param").address, "akash")) {
    return c.text("Invalid address", 400);
  }

  const skip = parseInt(c.req.valid("param").skip);
  const limit = Math.min(100, parseInt(c.req.valid("param").limit));

  if (isNaN(skip)) {
    return c.text("Invalid skip.", 400);
  }

  if (isNaN(limit)) {
    return c.text("Invalid limit.", 400);
    return;
  }

  const txs = await getTransactionByAddress(c.req.valid("param").address, skip, limit);

  return c.json(txs);
});
