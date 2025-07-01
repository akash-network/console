import { z } from "@hono/zod-openapi";

export const ListGpuQuerySchema = z.object({
  provider: z.string().optional(),
  vendor: z.string().optional(),
  model: z.string().optional(),
  memory_size: z.string().optional()
});
export const ListGpuResponseSchema = z.object({
  gpus: z.object({
    total: z.object({
      allocatable: z.number(),
      allocated: z.number()
    }),
    details: z.record(
      z.string(),
      z.array(
        z.object({
          model: z.string(),
          ram: z.string(),
          interface: z.string(),
          allocatable: z.number(),
          allocated: z.number()
        })
      )
    )
  })
});
export type ListGpuResponse = z.infer<typeof ListGpuResponseSchema>;

export const ListGpuModelsResponseSchema = z.array(
  z.object({
    name: z.string(),
    models: z.array(
      z.object({
        name: z.string(),
        memory: z.array(z.string()),
        interface: z.array(z.string())
      })
    )
  })
);

export const GpuBreakdownQuerySchema = z.object({
  vendor: z.string().optional(),
  model: z.string().optional()
});
export const GpuBreakdownResponseSchema = z.array(
  z.object({
    date: z.string(),
    vendor: z.string(),
    model: z.string(),
    providerCount: z.number(),
    nodeCount: z.number(),
    totalGpus: z.number(),
    leasedGpus: z.number(),
    gpuUtilization: z.number()
  })
);
export type GpuBreakdownQuery = z.infer<typeof GpuBreakdownQuerySchema>;

export const GpuPricesResponseSchema = z.object({
  availability: z.object({
    total: z.number(),
    available: z.number()
  }),
  models: z.array(
    z.object({
      vendor: z.string(),
      model: z.string(),
      ram: z.string(),
      interface: z.string(),
      availability: z.object({
        total: z.number(),
        available: z.number()
      }),
      providerAvailability: z.object({
        total: z.number(),
        available: z.number()
      }),
      price: z
        .object({
          currency: z.string().openapi({ example: "USD" }),
          min: z.number(),
          max: z.number(),
          avg: z.number(),
          weightedAverage: z.number(),
          med: z.number()
        })
        .nullable()
    })
  )
});
export type GpuPricesResponse = z.infer<typeof GpuPricesResponseSchema>;
