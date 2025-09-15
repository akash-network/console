import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { StartTrialRequestInputSchema, WalletResponseOutputSchema } from "@src/billing/http-schemas/wallet.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const route = createRoute({
  method: "post",
  path: "/v1/start-trial",
  summary: "Creates a managed wallet for a user",
  tags: ["Wallet"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: StartTrialRequestInputSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns a created wallet or 3D Secure authentication info",
      content: {
        "application/json": {
          schema: WalletResponseOutputSchema
        }
      }
    },
    202: {
      description: "3D Secure authentication required",
      content: {
        "application/json": {
          schema: WalletResponseOutputSchema
        }
      }
    }
  }
});

export const startTrialRouter = new OpenApiHonoHandler();

startTrialRouter.openapi(route, async function routeStartTrial(c) {
  const result = await container.resolve(WalletController).create(c.req.valid("json"));

  if (result.data.requires3DS) {
    return c.json(result, 202);
  }

  return c.json(result, 200);
});
