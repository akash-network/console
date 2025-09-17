import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { StartTrialRequestInputSchema, WalletResponse3DSOutputSchema, WalletResponseNo3DSOutputSchema } from "@src/billing/http-schemas/wallet.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const route = createRoute({
  method: "post",
  path: "/v1/start-trial",
  summary: "Start a trial period for a user",
  description:
    "Creates a managed wallet for a user and initiates a trial period. This endpoint handles payment method validation and may require 3D Secure authentication for certain payment methods. Returns wallet information and trial status.",
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
      description: "Trial started successfully and wallet created",
      content: {
        "application/json": {
          schema: WalletResponseNo3DSOutputSchema
        }
      }
    },
    202: {
      description: "3D Secure authentication required to complete trial setup",
      content: {
        "application/json": {
          schema: WalletResponse3DSOutputSchema
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
