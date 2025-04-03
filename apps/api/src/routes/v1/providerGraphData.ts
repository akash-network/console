import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getProviderGraphData } from "@src/services/db/statsService";
import type { ProviderStatsKey } from "@src/types";

const authorizedDataNames = ["count", "cpu", "gpu", "memory", "storage"];

const route = createRoute({
  method: "get",
  path: "/provider-graph-data/{dataName}",
  tags: ["Analytics"],
  request: {
    params: z.object({
      dataName: z.string().openapi({ example: "cpu", enum: authorizedDataNames })
    })
  },
  responses: {
    200: {
      description: "Returns provider graph data",
      content: {
        "application/json": {
          schema: z.object({
            currentValue: z.number(),
            compareValue: z.number(),
            snapshots: z.array(
              z.object({
                date: z.date().openapi({ example: "2021-07-01T00:00:00.000Z" }),
                value: z.number().openapi({ example: 100 })
              })
            ),
            now: z
              .object({
                count: z.number().openapi({ example: 100 }),
                cpu: z.number().openapi({ example: 100 }),
                gpu: z.number().openapi({ example: 100 }),
                memory: z.number().openapi({ example: 100 }),
                storage: z.number().openapi({ example: 100 })
              })
              .optional(),
            compare: z
              .object({
                count: z.number().openapi({ example: 100 }),
                cpu: z.number().openapi({ example: 100 }),
                gpu: z.number().openapi({ example: 100 }),
                memory: z.number().openapi({ example: 100 }),
                storage: z.number().openapi({ example: 100 })
              })
              .optional()
          })
        }
      }
    },
    404: {
      description: "Graph data not found"
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const dataName = c.req.valid("param").dataName;

  if (!authorizedDataNames.includes(dataName)) {
    console.log("Rejected graph request: " + dataName);
    return c.text("Graph data not found", 404);
  }

  const graphData = await getProviderGraphData(dataName as ProviderStatsKey);
  return c.json(graphData);
});
