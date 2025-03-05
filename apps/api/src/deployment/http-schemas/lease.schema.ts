import { z } from "zod";

export const CreateLeaseRequestSchema = z.object({
  manifest: z.string(),
  certificate: z.object({
    certPem: z.string(),
    keyPem: z.string()
  }),
  leases: z.array(
    z.object({
      dseq: z.string(),
      gseq: z.number(),
      oseq: z.number(),
      provider: z.string()
    })
  )
});

export type CreateLeaseRequest = z.infer<typeof CreateLeaseRequestSchema>;
