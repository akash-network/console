import { z } from "zod";

export const SignTxRequestInputSchema = z.object({
  data: z.object({
    userId: z.string(),
    messages: z
      .array(
        z.object({
          typeUrl: z.enum([
            "/akash.deployment.v1beta4.MsgCreateDeployment",
            "/akash.cert.v1.MsgCreateCertificate",
            "/akash.market.v1beta5.MsgCreateLease",
            "/akash.deployment.v1beta4.MsgUpdateDeployment",
            "/akash.deployment.v1beta4.MsgCloseDeployment",
            "/akash.escrow.v1.MsgAccountDeposit"
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
