import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getProposals } from "@src/services/external/apiNodeService";

const route = createRoute({
  method: "get",
  path: "/proposals",
  tags: ["Proposals"],
  responses: {
    200: {
      description: "Returns a list of proposals",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              id: z.number(),
              title: z.string(),
              status: z.string(),
              submitTime: z.string(),
              votingStartTime: z.string(),
              votingEndTime: z.string(),
              totalDeposit: z.number()
            })
          )
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const proposals = await getProposals();
  return c.json(proposals);
});
