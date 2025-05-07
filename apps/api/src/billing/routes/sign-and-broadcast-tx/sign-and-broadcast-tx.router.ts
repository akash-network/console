import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { SignTxRequestInputSchema, SignTxResponseOutputSchema } from "@src/billing/http-schemas/tx.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const route = createRoute({
  method: "post",
  path: "/v1/tx",
  summary: "Signs a transaction via a user managed wallet",
  tags: ["Wallet"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SignTxRequestInputSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns a signed transaction",
      content: {
        "application/json": {
          schema: SignTxResponseOutputSchema
        }
      }
    }
  }
});

export const signAndBroadcastTxRouter = new OpenApiHonoHandler();

signAndBroadcastTxRouter.openapi(route, async function routeSignTx(c) {
  const payload = await container.resolve(WalletController).signTx(c.req.valid("json"));
  return c.json(payload, 200);
});
