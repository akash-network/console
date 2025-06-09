import { z } from "zod";

export const PricingSpecsSchema = z.object({
  cpu: z.number().min(0).openapi({ description: "CPU in thousandths of a core. 1000 = 1 core", example: 1000 }),
  memory: z.number().min(0).openapi({ description: "Memory in bytes", type: "number", example: 1000000000 }),
  storage: z.number().min(0).openapi({ description: "Storage in bytes", type: "number", example: 1000000000 })
});

export const PricingBodySchema = PricingSpecsSchema.or(z.array(PricingSpecsSchema));

const PricingCalculationSchema = z.object({
  spec: PricingSpecsSchema,
  akash: z.number().openapi({ description: "Akash price estimation (USD/month)" }),
  aws: z.number().openapi({ description: "AWS price estimation (USD/month)" }),
  gcp: z.number().openapi({ description: "GCP price estimation (USD/month)" }),
  azure: z.number().openapi({ description: "Azure price estimation (USD/month)" })
});

export const PricingResponseSchema = PricingCalculationSchema.or(z.array(PricingCalculationSchema));

export type PricingBody = z.infer<typeof PricingBodySchema>;
export type PricingResponse = z.infer<typeof PricingResponseSchema>;
