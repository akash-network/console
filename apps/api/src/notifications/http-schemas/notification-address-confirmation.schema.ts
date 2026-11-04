import { z } from "@hono/zod-openapi";

export const CreateNotificationAddressConfirmationRequestSchema = z.object({
  data: z.object({
    token: z.string().min(1).max(256).openapi({ description: "The token of the confirmation link emailed to an address added to a notification channel" })
  })
});
