import { z } from "@hono/zod-openapi";

export const TransactionInvoiceParamsSchema = z.object({
  id: z.string().uuid().openapi({ description: "ID of the card payment's transaction" })
});

export const TransactionInvoiceResponseSchema = z.object({
  data: z.object({
    invoiceId: z.string(),
    invoicePdfUrl: z.string().nullable().openapi({ description: "Link to download the invoice PDF" })
  })
});

export type TransactionInvoiceResponse = z.infer<typeof TransactionInvoiceResponseSchema>;
