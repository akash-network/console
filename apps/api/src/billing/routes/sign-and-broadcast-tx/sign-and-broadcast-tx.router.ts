import { container } from "tsyringe";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { SignTxRequestInputSchema, SignTxResponseOutputSchema } from "@src/billing/http-schemas/tx.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const signAndBroadcastTxRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "post",
  path: "/v1/tx",
  summary: "Signs a transaction via a user managed wallet",
  tags: ["Wallet"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: {
      content: {
        "application/json": {
          schema: SignTxRequestInputSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns a signed transaction",
      content: {
        "application/json": {
          schema: SignTxResponseOutputSchema
        }
      }
    },
    400: {
      description:
        "A new deployment needs a project (`project_required`), a message type cannot be signed in an organization (`unsupported_message`), a deposit names no deployment or a fractional amount (`invalid_deposit`), or a deposit's denomination cannot be counted against a project budget (`unsupported_deposit_denom`)"
    },
    403: {
      description:
        "A deployment is filed in a project the caller cannot change, or a caller limited to some projects creates a certificate (`project_forbidden`), a deposit would take its project past its monthly budget (`project_budget_exceeded`), or a message acts for another account than the organization's wallet (`message_signer_mismatch`)"
    },
    503: { description: "A deposit could not be priced against its project's budget (`deposit_price_unavailable`). Transient and worth retrying" }
  }
});
signAndBroadcastTxRouter.openapi(route, async function routeSignTx(c) {
  const payload = await container.resolve(WalletController).signTx(c.req.valid("json"));
  return c.json(payload, 200);
});
