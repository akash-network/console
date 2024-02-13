import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getGraphData } from "@src/services/db/statsService";

const authorizedDataNames = [
  "dailyUAktSpent",
  "dailyUUsdcSpent",
  "dailyUUsdSpent",
  "dailyLeaseCount",
  "totalUAktSpent",
  "totalUUsdcSpent",
  "totalUUsdSpent",
  "activeLeaseCount",
  "totalLeaseCount",
  "activeCPU",
  "activeGPU",
  "activeMemory",
  "activeStorage"
];

const route = createRoute({
  method: "get",
  path: "/graph-data/{dataName}",
  tags: ["Analytics"],
  request: {
    params: z.object({
      dataName: z.string().openapi({ example: "dailyUAktSpent", enum: authorizedDataNames })
    })
  },
  responses: {
    200: {
      description: "Returns graph data",
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
            )
          })
        }
      }
    },
    404: {
      description: "Graph data not found"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const dataName = c.req.valid("param").dataName;

  if (!authorizedDataNames.includes(dataName)) {
    console.log("Rejected graph request: " + dataName);
    return c.text("Graph not found", 404);
  }

  const graphData = await getGraphData(dataName);
  return c.json(graphData);
});
