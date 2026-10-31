import { container } from "tsyringe";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { FeeAllowancesResponseSchema } from "@src/billing/http-schemas/balance.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

const route = createRoute({
  method: "get",
  path: "/v1/fee-allowances",
  summary: "List the current wallet's fee allowances",
  description: "Reads from the Akash Network the unexpired fee allowances granted to the current wallet.",
  operationId: "listFeeAllowances",
  tags: ["Wallet"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {},
  responses: {
    200: {
      description: "Returns the wallet's fee allowances",
      content: {
        "application/json": {
          schema: FeeAllowancesResponseSchema
        }
      }
    },
    404: {
      description: "UserWallet Not Found"
    }
  }
});

export const feeAllowancesRouter = new OpenApiHonoHandler().openapi(route, async function routeListFeeAllowances(c) {
  return c.json(await container.resolve(WalletController).listFeeAllowances(), 200);
});
