import { Readable } from "stream";
import { container } from "tsyringe";

import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import {
  ConfirmPaymentRequestSchema,
  ConfirmPaymentResponseSchema,
  CustomerTransactionsCsvExportQuerySchema,
  CustomerTransactionsQuerySchema,
  CustomerTransactionsResponseSchema
} from "@src/billing/http-schemas/stripe.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const stripeTransactionsRouter = new OpenApiHonoHandler();

const confirmPaymentRoute = createRoute({
  method: "post",
  path: "/v1/stripe/transactions/confirm",
  summary: "Confirm a payment using a saved payment method",
  description:
    "Processes a payment using a previously saved payment method. This endpoint handles wallet top-ups and may require 3D Secure authentication for certain payment methods or amounts.",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
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
      description: "Payment processed successfully",
      content: {
        "application/json": {
          schema: ConfirmPaymentResponseSchema
        }
      }
    },
    202: {
      description: "3D Secure authentication required to complete payment",
      content: {
        "application/json": {
          schema: ConfirmPaymentResponseSchema
        }
      }
    }
  }
});
stripeTransactionsRouter.openapi(confirmPaymentRoute, async function confirmPayment(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(StripeController).confirmPayment({
    userId: data.userId,
    paymentMethodId: data.paymentMethodId,
    amount: data.amount,
    currency: data.currency
  });

  // Check if 3D Secure is required
  if (result.data.requiresAction) {
    return c.json(result, 202);
  }

  return c.json(result, 200);
});

const getCustomerTransactionsRoute = createRoute({
  method: "get",
  path: "/v1/stripe/transactions",
  summary: "Get transaction history for the current customer",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
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

const exportTransactionsCsvRoute = createRoute({
  method: "get",
  path: "/v1/stripe/transactions/export",
  summary: "Export transaction history as CSV for the current customer",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
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
stripeTransactionsRouter.openapi(exportTransactionsCsvRoute, async function exportTransactionsCsv(c) {
  const { startDate, endDate, timezone } = c.req.valid("query");

  const filename = `transactions_${startDate.split("T")[0]}_to_${endDate.split("T")[0]}.csv`;

  const csvStream = await container.resolve(StripeController).exportTransactionsCsvStream({
    startDate,
    endDate,
    timezone
  });

  const readableStream = Readable.toWeb(Readable.from(csvStream)) as ReadableStream;

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Transfer-Encoding": "chunked"
    }
  });
});
