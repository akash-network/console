import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getDeployment } from "@src/services/external/apiNodeService";
import { isValidBech32Address } from "@src/utils/addresses";
import { openApiExampleAddress } from "@src/utils/constants";

const route = createRoute({
  method: "get",
  path: "/deployment/{owner}/{dseq}",
  summary: "Get deployment details",
  tags: ["Deployments"],
  request: {
    params: z.object({
      owner: z.string().openapi({
        description: "Owner's Address",
        example: openApiExampleAddress
      }),
      dseq: z.string().regex(/^\d+$/, "Invalid dseq, must be a positive integer").openapi({
        description: "Deployment DSEQ",
        type: "integer",
        example: "1000000"
      })
    })
  },
  responses: {
    200: {
      description: "Returns deployment details",
      content: {
        "application/json": {
          schema: z.object({
            owner: z.string(),
            dseq: z.string(),
            balance: z.number(),
            denom: z.string(),
            status: z.string(),
            totalMonthlyCostUDenom: z.number(),
            leases: z.array(
              z.object({
                gseq: z.number(),
                oseq: z.number(),
                provider: z.object({
                  address: z.string(),
                  hostUri: z.string(),
                  isDeleted: z.boolean(),
                  attributes: z.array(
                    z.object({
                      key: z.string(),
                      value: z.string()
                    })
                  )
                }),
                status: z.string(),
                monthlyCostUDenom: z.number(),
                cpuUnits: z.number(),
                gpuUnits: z.number(),
                memoryQuantity: z.number(),
                storageQuantity: z.number()
              })
            ),
            events: z.array(z.object({})), // TODO
            other: z.object({}) // TODO
          })
        }
      }
    },
    400: {
      description: "Invalid address or dseq"
    },
    404: {
      description: "Deployment not found"
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  if (!isValidBech32Address(c.req.valid("param").owner, "akash")) {
    return c.text("Invalid address", 400);
  }

  const deployment = await getDeployment(c.req.valid("param").owner, c.req.valid("param").dseq);

  if (deployment) {
    return c.json(deployment);
  } else {
    return c.text("Deployment not found", 404);
  }
});
