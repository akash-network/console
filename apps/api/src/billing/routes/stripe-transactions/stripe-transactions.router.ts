import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import { ConfirmPaymentRequestSchema, CustomerTransactionsQuerySchema, CustomerTransactionsResponseSchema } from "@src/billing/http-schemas/stripe.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const confirmPaymentRoute = createRoute({
  method: "post",
  path: "/v1/stripe/transactions/confirm",
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
      description: "Payment processed"
    }
  }
});

const getCustomerTransactionsRoute = createRoute({
  method: "get",
  path: "/v1/stripe/transactions",
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

export const stripeTransactionsRouter = new OpenApiHonoHandler();

stripeTransactionsRouter.openapi(confirmPaymentRoute, async function confirmPayment(c) {
  const { data } = c.req.valid("json");
  await container.resolve(StripeController).confirmPayment({
    userId: data.userId,
    paymentMethodId: data.paymentMethodId,
    amount: data.amount,
    currency: data.currency
  });
  return c.body(null, 200);
});

stripeTransactionsRouter.openapi(getCustomerTransactionsRoute, async function getCustomerTransactions(c) {
  const { limit, startingAfter, endingBefore, created } = c.req.valid("query");
  const response = await container.resolve(StripeController).getCustomerTransactions({
    limit,
    startingAfter,
    endingBefore,
    created
  });
  return c.json(response, 200);
});
