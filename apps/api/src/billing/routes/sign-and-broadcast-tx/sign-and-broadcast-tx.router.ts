import { container } from "tsyringe";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { SignTxRequestInputSchema, SignTxResponseOutputSchema } from "@src/billing/http-schemas/tx.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const signAndBroadcastTxRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "post",
  path: "/v1/tx",
  summary: "Signs a transaction via a user managed wallet",
  tags: ["Wallet"],
  security: SECURITY_BEARER_OR_API_KEY,
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
signAndBroadcastTxRouter.openapi(route, async function routeSignTx(c) {
  const payload = await container.resolve(WalletController).signTx(c.req.valid("json"));
  return c.json(payload, 200);
});
