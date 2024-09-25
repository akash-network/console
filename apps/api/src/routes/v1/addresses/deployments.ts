import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getAddressDeployments } from "@src/services/external/apiNodeService";
import { isValidBech32Address } from "@src/utils/addresses";
import { openApiExampleAddress } from "@src/utils/constants";

const maxLimit = 100;

const route = createRoute({
  method: "get",
  path: "/addresses/{address}/deployments/{skip}/{limit}",
  summary: "Get a list of deployments owner by an address.",
  tags: ["Addresses", "Deployments"],
  request: {
    params: z.object({
      address: z.string().openapi({
        description: "Wallet Address",
        example: openApiExampleAddress
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
      status: z.string().optional().openapi({
        description: "Filter by status", // TODO: Set possible statuses?
        example: "closed"
      }),
      reverseSorting: z.string().optional().openapi({
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
    },
    400: {
      description: "Invalid address"
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  if (!isValidBech32Address(c.req.valid("param").address, "akash")) {
    return c.text("Invalid address", 400);
  }

  const skip = parseInt(c.req.valid("param").skip);
  const limit = Math.min(maxLimit, parseInt(c.req.valid("param").limit));

  if (isNaN(skip)) {
    return c.text("Invalid skip.", 400);
  }

  if (isNaN(limit)) {
    return c.text("Invalid limit.", 400);
  }

  const deployments = await getAddressDeployments(c.req.valid("param").address, skip, limit, c.req.valid("query").reverseSorting === "true", {
    status: c.req.valid("query").status
  });

  return c.json(deployments);
});
