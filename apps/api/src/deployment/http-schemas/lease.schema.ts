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

export const LeaseServiceStatusSchema = z.object({
  name: z.string(),
  available: z.number(),
  total: z.number(),
  uris: z.array(z.string()),
  observed_generation: z.number(),
  replicas: z.number(),
  updated_replicas: z.number(),
  ready_replicas: z.number(),
  available_replicas: z.number()
});

export const ForwardedPortSchema = z.object({
  port: z.number(),
  externalPort: z.number(),
  host: z.string().optional(),
  available: z.number().optional()
});

export const IpSchema = z.object({
  IP: z.string(),
  Port: z.number(),
  ExternalPort: z.number(),
  Protocol: z.string()
});

export const LeaseStatusResponseSchema = z.object({
  forwarded_ports: z.record(z.string(), z.array(ForwardedPortSchema)),
  ips: z.record(z.string(), z.array(IpSchema)),
  services: z.record(z.string(), LeaseServiceStatusSchema)
});

export type CreateLeaseRequest = z.infer<typeof CreateLeaseRequestSchema>;
export type LeaseServiceStatus = z.infer<typeof LeaseServiceStatusSchema>;
export type LeaseStatusResponse = z.infer<typeof LeaseStatusResponseSchema>;
