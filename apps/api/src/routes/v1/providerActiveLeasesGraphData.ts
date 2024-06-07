import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getProviderActiveLeasesGraphData } from "@src/services/db/statsService";
import { isValidBech32Address } from "@src/utils/addresses";
import { openApiExampleProviderAddress } from "@src/utils/constants";

const route = createRoute({
  method: "get",
  path: "/provider-active-leases-graph-data/{providerAddress}",
  tags: ["Analytics", "Providers"],
  request: {
    params: z.object({
      providerAddress: z.string().openapi({ example: openApiExampleProviderAddress })
    })
  },
  responses: {
    200: {
      description: "Returns a provider's active leases graph data",
      content: {
        "application/json": {
          schema: z.object({
            currentValue: z.number(),
            compareValue: z.number(),
            snapshots: z.array(
              z.object({
                date: z.string().openapi({ example: "2021-07-01T00:00:00.000Z" }),
                value: z.number().openapi({ example: 100 })
              })
            ),
            now: z.object({
              count: z.number().openapi({ example: 100 })
            }),
            compare: z.object({
              count: z.number().openapi({ example: 100 })
            })
          })
        }
      }
    },
    400: {
      description: "Invalid address"
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const providerAddress = c.req.valid("param").providerAddress;

  if (!isValidBech32Address(providerAddress, "akash")) {
    return c.text("Invalid address", 400);
  }

  const graphData = await getProviderActiveLeasesGraphData(providerAddress);
  return c.json(graphData);
});
