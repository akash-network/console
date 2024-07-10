import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";

export const SignTxInputSchema = z.object({
  userId: z.string(),
  messages: z
    .array(
      z.object({
        typeUrl: z.string(),
        value: z.object({})
      })
    )
    .min(1)
    .openapi({}),
  fee: z.object({
    amount: z.array(
      z.object({
        denom: z.string(),
        amount: z.string()
      })
    ),
    gas: z.string(),
    granter: z.string().optional(),
    payer: z.string().optional()
  })
});

export const SignTxOutputSchema = z.string();
export type SignTxInput = z.infer<typeof SignTxInputSchema>;
export type SignTxOutput = z.infer<typeof SignTxOutputSchema>;

const route = createRoute({
  method: "post",
  path: "/v1/sign-tx",
  summary: "Signs a transaction via a user managed wallet",
  tags: ["Wallets"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SignTxInputSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns a signed transaction",
      content: {
        "application/json": {
          schema: SignTxOutputSchema
        }
      }
    }
  }
});
export const signTxRouter = new OpenAPIHono();

signTxRouter.openapi(route, async function routeSignTx(c) {
  const payload = await container.resolve(WalletController).signTx(c.req.valid("json"));
  return c.json(payload, 200);
});
