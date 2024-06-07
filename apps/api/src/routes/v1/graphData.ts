import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { AuthorizedGraphDataNames, getGraphData, isValidGraphDataName } from "@src/services/db/statsService";

const route = createRoute({
  method: "get",
  path: "/graph-data/{dataName}",
  tags: ["Analytics"],
  request: {
    params: z.object({
      dataName: z.string().openapi({ example: "dailyUAktSpent", enum: AuthorizedGraphDataNames })
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

export default new OpenAPIHono().openapi(route, async c => {
  const dataName = c.req.valid("param").dataName;

  if (!isValidGraphDataName(dataName)) {
    console.log("Rejected graph request: " + dataName);
    return c.text("Graph not found: " + dataName, 404);
  }

  const graphData = await getGraphData(dataName);
  return c.json(graphData);
});
