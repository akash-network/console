import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getValidators } from "@src/services/external/apiNodeService";

const route = createRoute({
  method: "get",
  path: "/validators",
  tags: ["Validators"],
  responses: {
    200: {
      description: "Returns validators",
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
