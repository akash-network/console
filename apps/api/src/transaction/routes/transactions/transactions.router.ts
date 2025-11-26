import { container } from "tsyringe";

import { createRoute } from "@src/core/services/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { TransactionController } from "@src/transaction/controllers/transaction/transaction.controller";
import {
  GetTransactionByHashParamsSchema,
  GetTransactionByHashResponseSchema,
  ListTransactionsQuerySchema,
  ListTransactionsResponseSchema
} from "@src/transaction/http-schemas/transaction.schema";

export const transactionsRouter = new OpenApiHonoHandler();

const listTransactionsRoute = createRoute({
  method: "get",
  path: "/v1/transactions",
  summary: "Get a list of transactions.",
  tags: ["Transactions"],
  security: SECURITY_NONE,
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
transactionsRouter.openapi(listTransactionsRoute, async function routeListTransactions(c) {
  const { limit } = c.req.valid("query");
  const transactions = await container.resolve(TransactionController).getTransactions(limit);

  return c.json(transactions);
});

const getTransactionByHashRoute = createRoute({
  method: "get",
  path: "/v1/transactions/{hash}",
  summary: "Get a transaction by hash.",
  tags: ["Transactions"],
  security: SECURITY_NONE,
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
transactionsRouter.openapi(getTransactionByHashRoute, async function routeGetTransactionByHash(c) {
  const { hash } = c.req.valid("param");

  const transaction = await container.resolve(TransactionController).getTransactionByHash(hash);
  if (transaction) {
    return c.json(transaction);
  } else {
    return c.text("Tx not found", 404);
  }
});
