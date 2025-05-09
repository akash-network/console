import { z } from "zod";
export const AuditorListResponseSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    website: z.string()
  })
);

export type AuditorListResponse = z.infer<typeof AuditorListResponseSchema>;
