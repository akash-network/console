import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { BidListResponseOutputSchema } from "@src/billing/http-schemas/bids.schema";
import { OpenApiHonoHandled } from "@src/core/services/open-api-hono-handled/open-api-hono-handled";

export const GetTrialBidListRequestInputSchema = z.object({
  address: z.string().openapi({}),
  dseq: z.string().openapi({})
});
export type GetTrialBidListRequestInput = z.infer<typeof GetTrialBidListRequestInputSchema>;

const route = createRoute({
  method: "get",
  path: "/v1/trial-bids",
  summary: "Get a list of bids for trial accounts",
  tags: ["Bids"],
  request: {
    query: GetTrialBidListRequestInputSchema
  },
  responses: {
    200: {
      description: "Returns a list of bids for trial accounts",
      content: {
        "application/json": {
          schema: BidListResponseOutputSchema
        }
      }
    }
  }
});
export const trialBidsRouter = new OpenApiHonoHandled();

trialBidsRouter.openapi(route, async function routeGetTrialBidList(c) {
  return c.json(await container.resolve(WalletController).getTrialBidList(c.req.valid("query")), 200);
});
