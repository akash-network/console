import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import {
  ConfirmPaymentRequestSchema,
  CustomerTransactionsCsvExportQuerySchema,
  CustomerTransactionsQuerySchema,
  CustomerTransactionsResponseSchema
} from "@src/billing/http-schemas/stripe.schema";
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

const exportTransactionsCsvRoute = createRoute({
  method: "get",
  path: "/v1/stripe/transactions/export",
  summary: "Export transaction history as CSV for the current customer",
  tags: ["Payment"],
  request: {
    query: CustomerTransactionsCsvExportQuerySchema
  },
  responses: {
    200: {
      description: "CSV file with transaction data",
      content: {
        "text/csv": {
          schema: {
            type: "string",
            format: "binary"
          }
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
  const { limit, startingAfter, endingBefore, startDate, endDate } = c.req.valid("query");
  const response = await container.resolve(StripeController).getCustomerTransactions({
    limit,
    startingAfter,
    endingBefore,
    startDate,
    endDate
  });
  return c.json(response, 200);
});

stripeTransactionsRouter.openapi(exportTransactionsCsvRoute, async function exportTransactionsCsv(c) {
  const { startDate, endDate } = c.req.valid("query");

  const filename = `transactions_${startDate.split("T")[0]}_to_${endDate.split("T")[0]}.csv`;

  const csvStream = await container.resolve(StripeController).exportTransactionsCsvStream({
    startDate,
    endDate
  });

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of csvStream) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Transfer-Encoding": "chunked"
    }
  });
});
