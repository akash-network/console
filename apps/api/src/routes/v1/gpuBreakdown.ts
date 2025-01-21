import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getGpuBreakdownByVendorAndModel } from "@src/services/db/gpuBreakdownService";

const route = createRoute({
  method: "get",
  path: "/gpu-breakdown",
  tags: ["Gpu"],
  summary: "Gets gpu analytics breakdown by vendor and model. If no vendor or model is provided, all GPUs are returned.",
  request: {
    query: z.object({
      vendor: z.string().optional(),
      model: z.string().optional()
    })
  },
  responses: {
    200: {
      description: "Gets gpu analytics breakdown by vendor and model. If no vendor or model is provided, all GPUs are returned.",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              date: z.string(),
              vendor: z.string(),
              model: z.string(),
              provider_count: z.number(),
              node_count: z.number(),
              total_gpus: z.number(),
              leased_gpus: z.number(),
              gpuUtilization: z.number()
            })
          )
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const gpuBreakdown = await getGpuBreakdownByVendorAndModel(c.req.query("vendor"), c.req.query("model"));
  return c.json(gpuBreakdown);
});
