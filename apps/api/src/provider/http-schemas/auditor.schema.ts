import { z } from "zod";

export const AuditorSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  website: z.string()
});

export type Auditor = z.infer<typeof AuditorSchema>;

export const AuditorListResponseSchema = z.array(AuditorSchema);

export type AuditorListResponse = z.infer<typeof AuditorListResponseSchema>;
