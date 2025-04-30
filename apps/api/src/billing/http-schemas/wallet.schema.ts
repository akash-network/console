import { z } from "zod";

const WalletOutputSchema = z.object({
  id: z.number().openapi({}),
  userId: z.string().openapi({}),
  creditAmount: z.number().openapi({}),
  address: z.string().openapi({}),
  isTrialing: z.boolean()
});

export const WalletResponseOutputSchema = z.object({
  data: WalletOutputSchema
});

export const WalletListResponseOutputSchema = z.object({
  data: z.array(WalletOutputSchema)
});

export const SignTxRequestInputSchema = z.object({
  data: z.object({
    userId: z.string(),
    messages: z
      .array(
        z.object({
          typeUrl: z.enum([
            "/akash.deployment.v1beta3.MsgCreateDeployment",
            "/akash.cert.v1beta3.MsgCreateCertificate",
            "/akash.market.v1beta4.MsgCreateLease",
            "/akash.deployment.v1beta3.MsgUpdateDeployment",
            "/akash.deployment.v1beta3.MsgCloseDeployment",
            "/akash.deployment.v1beta3.MsgDepositDeployment"
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

export const StartTrialRequestInputSchema = z.object({
  data: z.object({
    userId: z.string().openapi({})
  })
});

export type WalletOutputResponse = z.infer<typeof WalletResponseOutputSchema>;
export type WalletListOutputResponse = z.infer<typeof WalletListResponseOutputSchema>;
export type SignTxRequestInput = z.infer<typeof SignTxRequestInputSchema>;
export type SignTxResponseOutput = z.infer<typeof SignTxResponseOutputSchema>;
export type StartTrialRequestInput = z.infer<typeof StartTrialRequestInputSchema>;
