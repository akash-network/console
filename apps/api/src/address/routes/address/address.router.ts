import { container } from "tsyringe";

import { AddressController } from "@src/address/controllers/address/address.controller";
import {
  GetAddressParamsSchema,
  GetAddressResponseSchema,
  GetAddressTransactionsParamsSchema,
  GetAddressTransactionsResponseSchema
} from "@src/address/http-schemas/address.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

export const addressRouter = new OpenApiHonoHandler();

const getAddressRoute = createRoute({
  method: "get",
  path: "/v1/addresses/{address}",
  summary: "Get address details",
  tags: ["Addresses"],
  security: SECURITY_NONE,
  request: {
    params: GetAddressParamsSchema
  },
  responses: {
    200: {
      description: "Returns address details",
      content: {
        "application/json": {
          schema: GetAddressResponseSchema
        }
      }
    },
    400: {
      description: "Invalid address"
    }
  }
});
addressRouter.openapi(getAddressRoute, async function routeGetAddress(c) {
  const { address } = c.req.valid("param");
  const addressDetails = await container.resolve(AddressController).getAddressDetails(address);

  return c.json(addressDetails);
});

const getAddressTransactionsRoute = createRoute({
  method: "get",
  path: "/v1/addresses/{address}/transactions/{skip}/{limit}",
  summary: "Get a list of transactions for a given address.",
  tags: ["Addresses", "Transactions"],
  security: SECURITY_NONE,
  request: {
    params: GetAddressTransactionsParamsSchema
  },
  responses: {
    200: {
      description: "Returns transaction list",
      content: {
        "application/json": {
          schema: GetAddressTransactionsResponseSchema
        }
      }
    },
    400: {
      description: "Invalid address or parameters"
    }
  }
});
addressRouter.openapi(getAddressTransactionsRoute, async function routeGetAddressTransactions(c) {
  const { address, skip, limit } = c.req.valid("param");
  const transactions = await container.resolve(AddressController).getTransactions({
    address,
    skip,
    limit
  });

  return c.json(transactions);
});
