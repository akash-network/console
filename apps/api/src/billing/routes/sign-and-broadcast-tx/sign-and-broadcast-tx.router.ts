import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { OpenApiHonoHandled } from "@src/core/services/open-api-hono-handled/open-api-hono-handled";

export const SignTxRequestInputSchema = z.object({
  data: z.object({
    userId: z.string(),
    messages: z
      .array(
        z.object({
          typeUrl: z.string(),
          value: z.string()
        })
      )
      .min(1)
      .openapi({})
  })
});

export const SignTxResponseOutputSchema = z.object({
  data: z.object({
    code: z.number(),
    transactionHash: z.string(),
    rawLog: z.string()
  })
});
export type SignTxRequestInput = z.infer<typeof SignTxRequestInputSchema>;
export type SignTxResponseOutput = z.infer<typeof SignTxResponseOutputSchema>;

const route = createRoute({
  method: "post",
  path: "/v1/tx",
  summary: "Signs a transaction via a user managed wallet",
  tags: ["Wallets"],
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
    }
  }
});

export const signAndBroadcastTxRouter = new OpenApiHonoHandled();

signAndBroadcastTxRouter.openapi(route, async function routeSignTx(c) {
  const payload = await container.resolve(WalletController).signTx(c.req.valid("json"));
  return c.json(payload, 200);
});
