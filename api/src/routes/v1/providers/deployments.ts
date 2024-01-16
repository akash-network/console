import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getProviderDeployments } from "@src/db/deploymentProvider";

const route = createRoute({
  method: "get",
  path: "/providers/{provider}/deployments/{skip}/{limit}/{status}", // TODO: Put back status as optional,
  summary: "Get a list of deployments for a provider.",
  tags: ["Providers", "Deployments"],
  request: {
    params: z.object({
      provider: z.string().openapi({
        description: "Provider Address",
        example: "akash18ga02jzaq8cw52anyhzkwta5wygufgu6zsz6xc"
      }),
      skip: z.string().openapi({
        description: "Deployments to skip",
        example: "10"
      }),
      limit: z.string().openapi({
        description: "Deployments to return",
        example: "10"
      }),
      status: z
        .string()
        .optional()
        .openapi({
          description: "Filter by status", // TODO: Set possible statuses?
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
  const limit = Math.min(100, parseInt(c.req.valid("param").limit));
  const statusParam = c.req.valid("param").status as "active" | "closed" | undefined;
  // TODO: Validate skip/limit
  if (statusParam && statusParam !== "active" && statusParam !== "closed") {
    return c.text(`Invalid status filter: "${statusParam}". Valid values are "active" and "closed".`, 400);
  }

  const deployments = await getProviderDeployments(c.req.valid("param").provider, skip, limit, statusParam);

  return c.json(deployments);
});
