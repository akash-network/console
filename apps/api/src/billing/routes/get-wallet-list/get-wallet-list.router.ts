import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { WalletListResponseOutputSchema } from "@src/billing/http-schemas/wallet.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

export const GetWalletRequestQuerySchema = z.object({
  userId: z.string().openapi({}),
  awaitSessionId: z.string().optional().openapi({})
});
export type GetWalletQuery = z.infer<typeof GetWalletRequestQuerySchema>;

const route = createRoute({
  method: "get",
  path: "/v1/wallets",
  summary: "Get a list of wallets",
  tags: ["Wallet"],
  request: {
    query: GetWalletRequestQuerySchema
  },
  responses: {
    200: {
      description: "Returns a created wallet",
      content: {
        "application/json": {
          schema: WalletListResponseOutputSchema
        }
      }
    }
  }
});
export const getWalletListRouter = new OpenApiHonoHandler();

getWalletListRouter.openapi(route, async function routeGetWallet(c) {
  return c.json(await container.resolve(WalletController).getWallets(c.req.valid("query")), 200);
});
