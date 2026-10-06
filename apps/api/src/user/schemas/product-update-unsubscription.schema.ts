import { z } from "@hono/zod-openapi";

export const CreateProductUpdateUnsubscriptionQuerySchema = z.object({
  token: z.string().min(1).max(256).openapi({ description: "The signed token from the unsubscribe link in a product update email" })
});
