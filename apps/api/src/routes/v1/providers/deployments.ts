import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getProviderDeployments, getProviderDeploymentsCount } from "@src/services/db/deploymentService";
import { openApiExampleProviderAddress } from "@src/utils/constants";

const maxLimit = 100;

const route = createRoute({
  method: "get",
  path: "/providers/{provider}/deployments/{skip}/{limit}",
  summary: "Get a list of deployments for a provider.",
  tags: ["Providers", "Deployments"],
  request: {
    params: z.object({
      provider: z.string().openapi({
        description: "Provider Address",
        example: openApiExampleProviderAddress
      }),
      skip: z.string().openapi({
        description: "Deployments to skip",
        example: "10"
      }),
      limit: z.string().openapi({
        description: "Deployments to return",
        example: "10",
        maximum: maxLimit
      })
    }),
    query: z.object({
      status: z
        .string()
        .optional()
        .openapi({
          description: "Filter by status",
          enum: ["active", "closed"],
          example: "closed"
        })
    })
  },
  responses: {
    200: {
      description: "Returns deployment list",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              owner: z.string(),
              dseq: z.string(),
              denom: z.string(),
              createdHeight: z.number(),
              createdDate: z.string().nullable(),
              status: z.string(), //TODO
              balance: z.number(),
              transferred: z.number(),
              settledAt: z.number().nullable(),
              resources: z.object({
                cpu: z.number(),
                memory: z.number(),
                gpu: z.number(),
                ephemeralStorage: z.number(),
                persistentStorage: z.number()
              }),
              leases: z.array(
                z.object({
                  provider: z.string(),
                  gseq: z.number(),
                  oseq: z.number(),
                  price: z.number(),
                  createdHeight: z.number(),
                  createdDate: z.string().nullable(),
                  closedHeight: z.number().nullable(),
                  closedDate: z.string().nullable(),
                  status: z.string(), //TODO
                  resources: z.object({
                    cpu: z.number(),
                    memory: z.number(),
                    gpu: z.number(),
                    ephemeralStorage: z.number(),
                    persistentStorage: z.number()
                  })
                })
              )
            })
          )
        }
      }
    },
    400: {
      description: "Invalid status filter"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const skip = parseInt(c.req.valid("param").skip);
  const limit = Math.min(maxLimit, parseInt(c.req.valid("param").limit));
  const statusParam = c.req.query("status") as "active" | "closed" | undefined;
  // TODO: Validate skip/limit
  if (statusParam && statusParam !== "active" && statusParam !== "closed") {
    return c.text(`Invalid status filter: "${statusParam}". Valid values are "active" and "closed".`, 400);
  }

  const deploymentCountQuery = getProviderDeploymentsCount(c.req.valid("param").provider, statusParam);
  const deploymentsQuery = getProviderDeployments(c.req.valid("param").provider, skip, limit, statusParam);

  const [deploymentCount, deployments] = await Promise.all([deploymentCountQuery, deploymentsQuery]);

  return c.json({
    total: deploymentCount,
    deployments: deployments
  });
});
