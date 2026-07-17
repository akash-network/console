import { HonoAdapter } from "@x402/hono";
import { container } from "tsyringe";

import { X402Controller } from "@src/billing/controllers/x402/x402.controller";
import {
  X402DiscoveryResponseSchema,
  X402PaymentRequiredResponseSchema,
  X402TopUpQuerySchema,
  X402TopUpResponseSchema
} from "@src/billing/http-schemas/x402.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY, SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

export const x402Router = new OpenApiHonoHandler();

const topUpRoute = createRoute({
  method: "post",
  operationId: "createUsdcTopUp",
  path: "/v1/x402/top-up",
  summary: "Top up Console credits with a USDC payment (x402)",
  description:
    "Pay-per-request wallet top-up using the x402 payment protocol. " +
    "Call without an X-PAYMENT header to receive a 402 response describing the accepted payment (network, asset, amount, payTo). " +
    "Retry with a signed X-PAYMENT header to settle the payment on-chain and credit your Console balance. " +
    "The amount query parameter is the top-up size in USD.",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    query: X402TopUpQuerySchema
  },
  responses: {
    200: {
      description: "Payment settled and Console balance credited",
      content: {
        "application/json": {
          schema: X402TopUpResponseSchema
        }
      }
    },
    402: {
      description: "Payment required or payment invalid/failed to settle",
      content: {
        "application/json": {
          schema: X402PaymentRequiredResponseSchema
        }
      }
    },
    409: {
      description: "Payment already used for a previous top-up"
    }
  }
});
x402Router.openapi(topUpRoute, async function x402TopUp(c) {
  const { amount } = c.req.valid("query");
  const adapter = new HonoAdapter(c);
  const result = await container.resolve(X402Controller).topUp(
    {
      adapter,
      path: c.req.path,
      method: c.req.method,
      paymentHeader: adapter.getHeader("payment-signature") || adapter.getHeader("x-payment")
    },
    amount
  );

  switch (result.type) {
    case "payment-required":
    case "payment-rejected": {
      Object.entries(result.response.headers).forEach(([key, value]) => c.header(key, value));
      if (result.response.isHtml) {
        return c.html(String(result.response.body ?? ""), result.response.status as 402);
      }
      return c.json(result.response.body ?? {}, result.response.status as 402);
    }
    case "duplicate-payment":
      return c.json({ error: "Conflict", message: "This payment was already used for a top-up", transactionId: result.transactionId }, 409);
    case "success": {
      Object.entries(result.headers).forEach(([key, value]) => c.header(key, value));
      return c.json({ data: result.data }, 200);
    }
  }
});

const discoveryRoute = createRoute({
  method: "get",
  operationId: "listPayableResources",
  path: "/v1/x402/discovery",
  summary: "Discover x402 payable resources and their accepted payments",
  description:
    "Public discovery document listing every x402-protected resource and the payments it accepts " +
    "(route, scheme, network, asset/amount bounds, payTo). Mirrors the accepts returned in a 402 response, " +
    "derived from the same canonical source, so agents can plan a payment without first triggering a 402.",
  tags: ["Payment"],
  security: SECURITY_NONE,
  request: {},
  responses: {
    200: {
      description: "The x402 discovery document",
      content: {
        "application/json": {
          schema: X402DiscoveryResponseSchema
        }
      }
    },
    404: {
      description: "x402 payments are not enabled"
    }
  }
});
x402Router.openapi(discoveryRoute, async function x402Discovery(c) {
  const result = container.resolve(X402Controller).getDiscovery();
  return c.json(result, 200);
});
