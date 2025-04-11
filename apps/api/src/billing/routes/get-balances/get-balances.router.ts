import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { GetBalancesQuerySchema, GetBalancesResponseOutputSchema } from "@src/billing/http-schemas/balance.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const route = createRoute({
  method: "get",
  path: "/v1/balances",
  summary: "Get user balances",
  tags: ["Wallet"],
  request: {
    query: GetBalancesQuerySchema
  },
  responses: {
    200: {
      description: "Returns user balances",
      content: {
        "application/json": {
          schema: GetBalancesResponseOutputSchema
        }
      }
    }
  }
});

export const getBalancesRouter = new OpenApiHonoHandler().openapi(route, async function routeGetBalances(c) {
  const query = c.req.valid("query");
  return c.json(await container.resolve(WalletController).getBalances(query.address), 200);
});
