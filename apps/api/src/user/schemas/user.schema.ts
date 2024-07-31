import { z } from "zod";

export const AnonymousUserResponseOutputSchema = z.object({
  data: z
    .object({
      id: z.string().openapi({})
    })
    .openapi({})
});

export type AnonymousUserResponseOutput = z.infer<typeof AnonymousUserResponseOutputSchema>;
