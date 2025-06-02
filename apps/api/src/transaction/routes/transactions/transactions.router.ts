import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { TransactionController } from "@src/transaction/controllers/transaction/transaction.controller";
import {
  GetTransactionByHashParamsSchema,
  GetTransactionByHashResponseSchema,
  ListTransactionsQuerySchema,
  ListTransactionsResponseSchema
} from "@src/transaction/http-schemas/transaction.schema";

const listTransactionsRoute = createRoute({
  method: "get",
  path: "/v1/transactions",
  summary: "Get a list of transactions.",
  tags: ["Transactions"],
  request: {
    query: ListTransactionsQuerySchema
  },
  responses: {
    200: {
      description: "Returns transaction list",
      content: {
        "application/json": {
          schema: ListTransactionsResponseSchema
        }
      }
    }
  }
});

const getTransactionByHashRoute = createRoute({
  method: "get",
  path: "/v1/transactions/{hash}",
  summary: "Get a transaction by hash.",
  tags: ["Transactions"],
  request: {
    params: GetTransactionByHashParamsSchema
  },
  responses: {
    200: {
      description: "Returns predicted block date",
      content: {
        "application/json": {
          schema: GetTransactionByHashResponseSchema
        }
      }
    },
    404: {
      description: "Transaction not found"
    }
  }
});

export const transactionsRouter = new OpenApiHonoHandler();

transactionsRouter.openapi(listTransactionsRoute, async function routeListTransactions(c) {
  const { limit } = c.req.valid("query");
  const transactions = await container.resolve(TransactionController).getTransactions(limit);

  return c.json(transactions);
});

transactionsRouter.openapi(getTransactionByHashRoute, async function routeGetTransactionByHash(c) {
  const { hash } = c.req.valid("param");

  const transaction = await container.resolve(TransactionController).getTransactionByHash(hash);
  if (transaction) {
    return c.json(transaction);
  } else {
    return c.text("Tx not found", 404);
  }
});
