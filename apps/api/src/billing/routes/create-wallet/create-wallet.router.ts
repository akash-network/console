import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { WalletResponseOutputSchema } from "@src/billing/http-schemas/wallet.schema";
import { OpenApiHonoHandled } from "@src/core/services/open-api-hono-handled/open-api-hono-handled";

export const CreateWalletRequestInputSchema = z.object({
  data: z.object({
    userId: z.string().openapi({})
  })
});

export type CreateWalletRequestInput = z.infer<typeof CreateWalletRequestInputSchema>;

const route = createRoute({
  method: "post",
  path: "/v1/wallets",
  summary: "Creates a managed wallet for a user",
  tags: ["Wallets"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateWalletRequestInputSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns a created wallet",
      content: {
        "application/json": {
          schema: WalletResponseOutputSchema
        }
      }
    }
  }
});
export const createWalletRouter = new OpenApiHonoHandled();

createWalletRouter.openapi(route, async function routeCreateWallet(c) {
  return c.json(await container.resolve(WalletController).create(c.req.valid("json")), 200);
});
