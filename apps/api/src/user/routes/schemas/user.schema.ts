import { z } from "zod";

export const anonymousUserOutputSchema = z.object({
  id: z.string().openapi({})
});

export type AnonymousUserOutput = z.infer<typeof anonymousUserOutputSchema>;
