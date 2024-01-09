import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getTransactions } from "@src/db/transactionsProvider";
import { getValidators } from "@src/providers/apiNodeProvider";

const route = createRoute({
  method: "get",
  path: "/validators",
  request: {},
  responses: {
    200: {
      description: "Returns predicted block date",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              operatorAddress: z.string(),
              moniker: z.string(),
              votingPower: z.number(),
              commission: z.number(),
              identity: z.string(),
              votingPowerRatio: z.number(),
              rank: z.number()
            })
          )
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const validators = await getValidators();
  return c.json(validators);
});
