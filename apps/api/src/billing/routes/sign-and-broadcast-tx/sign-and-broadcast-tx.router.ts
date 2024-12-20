import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

export const SignTxRequestInputSchema = z.object({
  data: z.object({
    userId: z.string(),
    messages: z
      .array(
        z.object({
          typeUrl: z.enum([
            "/akash.deployment.v1beta4.MsgCreateDeployment",
            "/akash.cert.v1.MsgCreateCertificate",
            "/akash.market.v1beta4.MsgCreateLease",
            "/akash.deployment.v1beta4.MsgUpdateDeployment",
            "/akash.deployment.v1beta4.MsgCloseDeployment",
            "/akash.deployment.v1beta4.MsgDepositDeployment"
          ]),
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
  tags: ["Wallet"],
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

export const signAndBroadcastTxRouter = new OpenApiHonoHandler();

signAndBroadcastTxRouter.openapi(route, async function routeSignTx(c) {
  const payload = await container.resolve(WalletController).signTx(c.req.valid("json"));
  return c.json(payload, 200);
});
