import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import {
  ConfirmPaymentRequestSchema,
  ConfirmPaymentResponseSchema,
  CustomerTransactionsQuerySchema,
  CustomerTransactionsResponseSchema
} from "@src/billing/http-schemas/stripe.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const confirmPaymentRoute = createRoute({
  method: "post",
  path: "/v1/transactions/confirm",
  summary: "Confirm a payment using a saved payment method",
  tags: ["Payment"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: ConfirmPaymentRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Payment processed",
      content: {
        "application/json": {
          schema: ConfirmPaymentResponseSchema
        }
      }
    }
  }
});

const getCustomerTransactionsRoute = createRoute({
  method: "get",
  path: "/v1/transactions",
  summary: "Get transaction history for the current customer",
  tags: ["Payment"],
  request: {
    query: CustomerTransactionsQuerySchema
  },
  responses: {
    200: {
      description: "Customer transactions retrieved successfully",
      content: {
        "application/json": {
          schema: CustomerTransactionsResponseSchema
        }
      }
    }
  }
});

export const transactionsRouter = new OpenApiHonoHandler();

transactionsRouter.openapi(confirmPaymentRoute, async function confirmPayment(c) {
  const body = await c.req.json();
  const response = await container.resolve(StripeController).confirmPayment(body);
  return c.json(response, 200);
});

transactionsRouter.openapi(getCustomerTransactionsRoute, async function getCustomerTransactions(c) {
  const { limit, startingAfter } = c.req.valid("query");
  const response = await container.resolve(StripeController).getCustomerTransactions({
    limit: limit ? parseInt(limit) : undefined,
    startingAfter
  });
  return c.json(response, 200);
});
