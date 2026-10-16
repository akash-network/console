import { z } from "@hono/zod-openapi";

export const TransactionInvoiceParamsSchema = z.object({
  id: z.string().uuid().openapi({ description: "ID of the card payment's transaction" })
});
