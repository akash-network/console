import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { WalletResponseOutputSchema } from "@src/billing/http-schemas/wallet.schema";
import { OpenApiHonoHandled } from "@src/core/services/open-api-hono-handled/open-api-hono-handled";

export const StartTrialRequestInputSchema = z.object({
  data: z.object({
    userId: z.string().openapi({})
  })
});

export type StartTrialRequestInput = z.infer<typeof StartTrialRequestInputSchema>;

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
    }
  }
});
export const startTrialRouter = new OpenApiHonoHandled();

startTrialRouter.openapi(route, async function routeStartTrial(c) {
  return c.json(await container.resolve(WalletController).create(c.req.valid("json")), 200);
});
