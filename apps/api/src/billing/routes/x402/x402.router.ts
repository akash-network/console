import { HonoAdapter } from "@x402/hono";
import { container } from "tsyringe";

import { X402Controller } from "@src/billing/controllers/x402/x402.controller";
import {
  X402PaymentRequiredResponseSchema,
  X402TopUpQuerySchema,
  X402TopUpResponseSchema,
  X402TransactionListQuerySchema,
  X402TransactionListResponseSchema
} from "@src/billing/http-schemas/x402.schema";
import { X402_ERROR_CODES } from "@src/billing/services/x402/x402-error-codes";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

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
    case "payment-required": {
      Object.entries(result.response.headers).forEach(([key, value]) => c.header(key, value));
      if (result.response.isHtml) {
        return c.html(String(result.response.body ?? ""), result.response.status as 402);
      }
      const body = result.response.body && typeof result.response.body === "object" ? result.response.body : {};
      // Surface a stable machine-readable code alongside the x402 SDK's payment-required body.
      return c.json({ ...body, code: result.code }, result.response.status as 402);
    }
    case "duplicate-payment":
      return c.json(
        {
          error: "Conflict",
          code: X402_ERROR_CODES.DUPLICATE_PAYMENT,
          message: "This payment was already used for a top-up",
          transactionId: result.transactionId
        },
        409
      );
    case "success": {
      Object.entries(result.headers).forEach(([key, value]) => c.header(key, value));
      return c.json({ data: result.data }, 200);
    }
  }
});

const listTransactionsRoute = createRoute({
  method: "get",
  operationId: "listUsdcTopUps",
  path: "/v1/x402/transactions",
  summary: "List your x402 USDC top-up transactions",
  description:
    "Returns the authenticated caller's x402 top-up history, newest first. " +
    "Each row exposes the transaction status, credited amount, network, settlement transaction hash and creation time. " +
    "Only the caller's own transactions are ever returned.",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    query: X402TransactionListQuerySchema
  },
  responses: {
    200: {
      description: "Paginated list of the caller's x402 top-up transactions",
      content: {
        "application/json": {
          schema: X402TransactionListResponseSchema
        }
      }
    }
  }
});
x402Router.openapi(listTransactionsRoute, async function x402ListTransactions(c) {
  const query = c.req.valid("query");
  const response = await container.resolve(X402Controller).listTransactions(query);
  return c.json(response, 200);
});
