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
    displayName: z.string().openapi({ example: "NVIDIA" }),
    models: z.array(
      z.object({
        name: z.string(),
        displayName: z.string().openapi({ example: "RTX 4090" }),
        memory: z.array(z.string()),
        interface: z.array(z.string())
      })
    )
  })
);

const DEFAULT_BREAKDOWN_WINDOW_DAYS = 30;
const MAX_BREAKDOWN_WINDOW_DAYS = 366;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toIsoDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function daysBefore(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return toIsoDate(date);
}

export const GpuBreakdownQuerySchema = z
  .object({
    vendor: z.string().optional(),
    model: z.string().optional(),
    startDate: z
      .string()
      .date()
      .optional()
      .openapi({
        description: `Start date (YYYY-MM-DD). Defaults to ${DEFAULT_BREAKDOWN_WINDOW_DAYS} days before endDate`,
        example: "2024-01-01"
      }),
    endDate: z.string().date().optional().openapi({
      description: "End date (YYYY-MM-DD), inclusive. Defaults to today (UTC)",
      example: "2024-01-31"
    })
  })
  .transform(data => {
    const endDate = data.endDate ?? toIsoDate(new Date());
    const startDate = data.startDate ?? daysBefore(endDate, DEFAULT_BREAKDOWN_WINDOW_DAYS);

    return { ...data, startDate, endDate };
  })
  .refine(
    data => {
      const spanInDays = Math.ceil((Date.parse(data.endDate) - Date.parse(data.startDate)) / MS_PER_DAY);

      return spanInDays >= 0 && spanInDays <= MAX_BREAKDOWN_WINDOW_DAYS;
    },
    {
      message: `Date range cannot exceed ${MAX_BREAKDOWN_WINDOW_DAYS} days and startDate must be before endDate`
    }
  );
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
