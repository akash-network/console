import { container } from "tsyringe";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { WalletBalancesResponseSchema } from "@src/billing/http-schemas/balance.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

const route = createRoute({
  method: "get",
  path: "/v1/wallet-balances",
  summary: "Get the current wallet's balances",
  description:
    "Reads from the Akash Network what the current wallet holds, what its deposit grants let it spend, and what the escrow of each of its active deployments holds.",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "getWalletBalances",
  tags: ["Wallet"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {},
  responses: {
    200: {
      description: "Returns the wallet's balances",
      content: {
        "application/json": {
          schema: WalletBalancesResponseSchema
        }
      }
    },
    404: {
      description: "UserWallet Not Found"
    }
  }
});

export const walletBalancesRouter = new OpenApiHonoHandler().openapi(route, async function routeGetWalletBalances(c) {
  return c.json(await container.resolve(WalletController).getWalletBalances(), 200);
});
