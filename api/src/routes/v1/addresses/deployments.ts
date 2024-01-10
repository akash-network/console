import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getAddressDeployments } from "@src/providers/apiNodeProvider";

const route = createRoute({
  method: "get",
  path: "/addresses/{address}/deployments/{skip}/{limit}",
  summary: "Get a list of deployments owner by an address.",
  tags: ["Addresses", "Deployments"],
  request: {
    params: z.object({
      address: z.string().openapi({
        param: { name: "address", in: "path" },
        description: "Wallet Address",
        example: "akash13265twfqejnma6cc93rw5dxk4cldyz2zyy8cdm"
      }),
      skip: z
        .string()
        .optional()
        .openapi({
          param: { name: "skip", in: "path" },
          description: "Deployments to skip",
          example: "10"
        }),
      limit: z
        .string()
        .optional()
        .openapi({
          param: { name: "limit", in: "path" },
          description: "Deployments to return",
          example: "10"
        })
    }),
    query: z.object({
      status: z
        .string()
        .optional()
        .openapi({
          param: { name: "status", in: "query" },
          description: "Filter by status", // TODO: Set possible statuses?
          example: "closed"
        }),
      reverseSorting: z
        .string()
        .optional()
        .openapi({
          param: { name: "reverseSorting", in: "query" },
          description: "Reverse sorting",
          example: "true"
        })
    })
  },
  responses: {
    200: {
      description: "Returns deployment list",
      content: {
        "application/json": {
          schema: z.object({
            count: z.number(),
            results: z.array(
              z.object({
                owner: z.string(),
                dseq: z.string(),
                status: z.string(),
                createdHeight: z.number(),
                cpuUnits: z.number(),
                gpuUnits: z.number(),
                memoryQuantity: z.number(),
                storageQuantity: z.number()
              })
            )
          })
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const skip = parseInt(c.req.valid("param").skip);
  const limit = Math.min(100, parseInt(c.req.valid("param").limit));

  // TODO Add param validation

  const deployments = await getAddressDeployments(c.req.valid("param").address, skip, limit, c.req.valid("query").reverseSorting === "true", {
    status: c.req.valid("query").status
  });

  return c.json(deployments);
});
