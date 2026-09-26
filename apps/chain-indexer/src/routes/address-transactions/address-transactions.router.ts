import { container } from "tsyringe";

import {
  ListAddressTransactionsParamsSchema,
  ListAddressTransactionsQuerySchema,
  ListAddressTransactionsResponseSchema
} from "@src/http-schemas/address-transactions.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { AddressTransactionsService } from "@src/services/address-transactions/address-transactions.service";
import { OpenApiHonoHandler } from "@src/services/open-api-hono-handler/open-api-hono-handler";

export const addressTransactionsRouter = new OpenApiHonoHandler();

const listAddressTransactionsRoute = createRoute({
  method: "get",
  path: "/v1/addresses/{address}/transactions",
  operationId: "listAddressTransactions",
  summary: "List the transactions an address signed or moved coins in",
  tags: ["Addresses", "Transactions"],
  request: {
    params: ListAddressTransactionsParamsSchema,
    query: ListAddressTransactionsQuerySchema
  },
  responses: {
    200: {
      description: "A page of the address's transactions, newest first, with the total",
      content: {
        "application/json": {
          schema: ListAddressTransactionsResponseSchema
        }
      }
    }
  }
});

addressTransactionsRouter.openapi(listAddressTransactionsRoute, async function routeListAddressTransactions(c) {
  const { address } = c.req.valid("param");
  const { skip, limit } = c.req.valid("query");
  return c.json({ data: await container.resolve(AddressTransactionsService).list(address, { skip, limit }) }, 200);
});
