import { z } from "zod";

export const transactionRowSchema = z.object({
  hash: z.string(),
  messages: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      data: z.any().optional(),
      isReceiver: z.boolean().optional(),
      amount: z.number().optional()
    })
  ),
  height: z.number(),
  datetime: z.string(),
  isSuccess: z.boolean(),
  error: z.string(),
  gasUsed: z.number(),
  gasWanted: z.number(),
  fee: z.number(),
  memo: z.string()
});

export type TransactionRowType = z.infer<typeof transactionRowSchema>;
