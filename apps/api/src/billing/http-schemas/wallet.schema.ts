import { z } from "zod";

export const WalletOutputSchema = z.object({
  id: z.number().openapi({}),
  userId: z.string().openapi({}),
  creditAmount: z.string().openapi({}),
  address: z.string().openapi({})
});
export type WalletOutput = z.infer<typeof WalletOutputSchema>;
