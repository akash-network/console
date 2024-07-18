import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { WalletOutputSchema } from "@src/billing/http-schemas/wallet.schema";
import { OpenApiHonoHandled } from "@src/core/services/open-api-hono-handled/open-api-hono-handled";

export const GetWalletQuerySchema = z.object({
  userId: z.string().openapi({})
});
export type GetWalletQuery = z.infer<typeof GetWalletQuerySchema>;

const route = createRoute({
  method: "get",
  path: "/v1/wallets",
  summary: "Get a list of wallets",
  tags: ["Wallets"],
  request: {
    query: GetWalletQuerySchema
  },
  responses: {
    200: {
      description: "Returns a created wallet",
      content: {
        "application/json": {
          schema: z.array(WalletOutputSchema)
        }
      }
    }
  }
});
export const getWalletRouter = new OpenApiHonoHandled();

getWalletRouter.openapi(route, async function routeGetWallet(c) {
  return c.json(await container.resolve(WalletController).getWallets(c.req.valid("query")), 200);
});
