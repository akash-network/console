import { container } from "tsyringe";

import { TxController } from "@src/controllers/tx/tx.controller";
import {
  SignAndBroadcastDerivedRequestInputSchema,
  SignAndBroadcastFundingRequestInputSchema,
  SignAndBroadcastResponseOutputSchema
} from "@src/http-schemas/tx-signer/tx-signer.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/services/open-api-hono-handler/open-api-hono-handler";

export const txRouter = new OpenApiHonoHandler();

const fundingRoute = createRoute({
  method: "post",
  path: "/v1/tx/funding",
  summary: "Signs and broadcasts a transaction with the funding wallet",
  tags: ["Tx"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SignAndBroadcastFundingRequestInputSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns the broadcasted transaction",
      content: {
        "application/json": {
          schema: SignAndBroadcastResponseOutputSchema
        }
      }
    }
  }
});

txRouter.openapi(fundingRoute, async c => {
  const payload = await container.resolve(TxController).signWithFundingWallet(c.req.valid("json"));
  return c.json(payload, 200);
});

const derivedRoute = createRoute({
  method: "post",
  path: "/v1/tx/derived",
  summary: "Signs and broadcasts a transaction with a derived wallet",
  tags: ["Tx"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SignAndBroadcastDerivedRequestInputSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns the broadcasted transaction",
      content: {
        "application/json": {
          schema: SignAndBroadcastResponseOutputSchema
        }
      }
    }
  }
});

txRouter.openapi(derivedRoute, async c => {
  const payload = await container.resolve(TxController).signWithDerivedWallet(c.req.valid("json"));
  return c.json(payload, 200);
});
