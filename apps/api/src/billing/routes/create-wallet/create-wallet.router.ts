import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { WalletOutputSchema } from "@src/billing/http-schemas/wallet.schema";
import { OpenApiHonoHandled } from "@src/core/services/open-api-hono-handled/open-api-hono-handled";

export const CreateWalletInputSchema = z.object({
  userId: z.string().openapi({})
});

export type CreateWalletInput = z.infer<typeof CreateWalletInputSchema>;

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
      description: "Returns a created wallet",
      content: {
        "application/json": {
          schema: WalletOutputSchema
        }
      }
    }
  }
});
export const createWalletRouter = new OpenApiHonoHandled();

createWalletRouter.openapi(route, async function routeCreateWallet(c) {
  return c.json(await container.resolve(WalletController).create(c.req.valid("json")), 200);
});
