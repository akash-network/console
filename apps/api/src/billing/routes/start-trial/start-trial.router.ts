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
      description: "Returns a created wallet",
      content: {
        "application/json": {
          schema: WalletResponseOutputSchema
        }
      }
    },
    400: {
      description: "User must have a validated payment method to start trial",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" }
            }
          }
        }
      }
    }
  }
});

export const startTrialRouter = new OpenApiHonoHandler();

startTrialRouter.openapi(route, async function routeStartTrial(c) {
  return c.json(await container.resolve(WalletController).create(c.req.valid("json")), 200);
});
