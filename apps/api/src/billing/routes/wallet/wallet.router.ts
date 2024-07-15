import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";

export const CreateWalletInputSchema = z.object({
  userId: z.string().openapi({})
});

export const CreateWalletOutputSchema = z.void();
export type CreateWalletInput = z.infer<typeof CreateWalletInputSchema>;
export type CreateWalletOutput = z.infer<typeof CreateWalletOutputSchema>;

const route = createRoute({
  method: "post",
  path: "/v1/wallets",
  summary: "Creates a managed wallet for a user",
  tags: ["Wallets"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateWalletInputSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns a created wallet"
    }
  }
});
export const walletRouter = new OpenAPIHono();

walletRouter.openapi(route, async function routeWallet(c) {
  await container.resolve(WalletController).create(c.req.valid("json"));
  return c.json(undefined, 200);
});
