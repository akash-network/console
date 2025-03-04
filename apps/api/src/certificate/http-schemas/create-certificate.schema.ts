import { z } from "zod";

export const CreateCertificateResponseSchema = z.object({
  data: z.object({
    certPem: z.string().min(1, "Cert PEM is required"),
    pubkeyPem: z.string().min(1, "Pubkey PEM is required"),
    encryptedKey: z.string().min(1, "Encrypted key is required")
  })
});

export type CreateCertificateResponse = z.infer<typeof CreateCertificateResponseSchema>;
