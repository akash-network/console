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
export type WalletOutputResponse = z.infer<typeof WalletResponseOutputSchema>;
export type WalletListOutputResponse = z.infer<typeof WalletListResponseOutputSchema>;
